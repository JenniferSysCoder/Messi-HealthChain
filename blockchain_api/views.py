from datetime import datetime

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .nodes.node_manager import NodeManager
from .repositories.json_repository import read, write
from .services.blockchain_service import (
    create_clinical_record,
    create_genesis,
    get_blockchain_status,
    get_blocks,
    get_patient_history,
)
from .services.node_service import NodeService


def _patient_history_record(patient):
    return {
        "id": f"PACIENTE-{patient.get('id')}",
        "timestamp": patient.get("fecha_registro", ""),
        "entidad_emisora": "Registro de paciente",
        "paciente_id": patient.get("id", ""),
        "categoria": "REGISTRO_PACIENTE",
        "datos": {k: patient.get(k, "") for k in (
            "nombre", "dui", "fecha_nacimiento", "tipo_sangre", "alergias",
            "vacunas", "cronicas", "telefono", "direccion"
        )},
        "block_id": None,
        "block_hash": None,
        "virtual": True,
    }


def _professional_valid(registro, tipo):
    registro = str(registro or "").strip().upper()
    tipo = str(tipo or "").strip().upper()
    if tipo not in {"JVPM", "JVPP", "JVPO", "JVPE"}:
        return None
    for professional in read("profesionales.json", []):
        if str(professional.get("tipo", "")).upper() == tipo and str(professional.get("registro", "")).upper() == registro:
            if professional.get("activo", True) is False:
                return None
            return professional
    return None


def _credential_from(request):
    return str(request.data.get("registro", "")).strip(), str(request.data.get("tipo", "")).strip()


class ValidarProfesionalView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        registro, tipo = _credential_from(request)
        professional = _professional_valid(registro, tipo)
        if not professional:
            return Response({"success": False, "message": "Las credenciales profesionales no son válidas."}, status=401)
        return Response({
            "success": True,
            "message": "Credenciales profesionales válidas.",
            "profesional": {
                "nombre": professional.get("nombre", ""),
                "tipo": professional.get("tipo", ""),
                "registro": professional.get("registro", ""),
                "especialidad": professional.get("especialidad", ""),
                "entidad_nombre": professional.get("entidad_nombre", ""),
            },
        })


class PacientesView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"success": True, "pacientes": read("pacientes.json", [])})

    def post(self, request):
        registro, tipo = _credential_from(request)
        professional = _professional_valid(registro, tipo)
        if not professional:
            return Response({"success": False, "message": "Debe validar las credenciales profesionales."}, status=401)

        required = ["nombre", "dui", "fecha_nacimiento", "tipo_sangre", "alergias", "vacunas", "cronicas"]
        data = {key: str(request.data.get(key, "")).strip() for key in required}
        if any(not value for value in data.values()):
            return Response({"success": False, "message": "Complete todos los campos clínicos obligatorios."}, status=400)
        if not __import__("re").fullmatch(r"\d{8}-\d", data["dui"]):
            return Response({"success": False, "message": "El DUI debe tener el formato 00000000-0."}, status=400)
        try:
            birth = datetime.strptime(data["fecha_nacimiento"], "%Y-%m-%d").date()
            if birth > datetime.now().date():
                return Response({"success": False, "message": "La fecha de nacimiento no puede ser futura."}, status=400)
        except ValueError:
            return Response({"success": False, "message": "La fecha de nacimiento no es válida."}, status=400)
        if data["tipo_sangre"] not in {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}:
            return Response({"success": False, "message": "Tipo de sangre no válido."}, status=400)

        patients = read("pacientes.json", [])
        if any(p.get("dui") == data["dui"] for p in patients):
            return Response({"success": False, "message": "Ya existe un paciente con ese DUI."}, status=409)
        ids = [int(str(p.get("id", ""))[1:]) for p in patients if str(p.get("id", ""))[1:].isdigit()]
        patient = {
            "id": f"P{max(ids, default=0) + 1:03d}",
            **data,
            "telefono": str(request.data.get("telefono", "")).strip(),
            "direccion": str(request.data.get("direccion", "")).strip(),
            "fecha_registro": datetime.now().isoformat(timespec="seconds"),
            "estado": "ACTIVO",
        }
        patients.append(patient)
        write("pacientes.json", patients)
        history_record = _patient_history_record(patient)
        histories = [h for h in read("historiales.json", []) if not (h.get("paciente_id") == patient["id"] and h.get("virtual"))]
        histories.append(history_record)
        write("historiales.json", histories)
        return Response({"success": True, "paciente": patient, "history_record": history_record}, status=201)


class PacienteHistorialView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, paciente_id):
        registro = request.query_params.get("registro")
        tipo = request.query_params.get("tipo")
        if not _professional_valid(registro, tipo):
            return Response({"success": False, "message": "Debe validar las credenciales profesionales para consultar el historial."}, status=401)
        result = get_patient_history(paciente_id, request.query_params.get("node"))
        patient = next((p for p in read("pacientes.json", []) if p.get("id") == paciente_id), None)
        if not patient:
            return Response({"success": False, "message": "Paciente no encontrado."}, status=404)
        if not result:
            result = [h for h in read("historiales.json", []) if h.get("paciente_id") == paciente_id]
        if not result:
            result = [_patient_history_record(patient)]
        return Response({"success": True, "paciente_id": paciente_id, "historial": result, "paciente": patient})


class RegistroClinicoView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        paciente_id = str(request.data.get("paciente_id", "")).strip()
        categoria = str(request.data.get("categoria", "")).strip()
        datos = request.data.get("datos", {})
        if not paciente_id or not categoria or not isinstance(datos, dict):
            return Response({"success": False, "message": "Paciente, categoría y datos clínicos son obligatorios."}, status=400)
        patient = next((p for p in read("pacientes.json", []) if p.get("id") == paciente_id), None)
        if not patient:
            return Response({"success": False, "message": "El paciente no está registrado."}, status=404)
        for field in ("motivo_consulta", "diagnostico", "tratamiento", "observaciones"):
            if not str(datos.get(field, "")).strip():
                return Response({"success": False, "message": f"El campo {field.replace('_', ' ')} es obligatorio."}, status=400)
        datos["nombre"] = patient.get("nombre", "")
        for field in ("tipo_sangre", "alergias", "vacunas", "cronicas"):
            datos.setdefault(field, patient.get(field, ""))
        professional = _professional_valid(request.data.get("registro"), request.data.get("tipo"))
        if not professional:
            return Response({"success": False, "message": "Credenciales profesionales inválidas."}, status=401)
        result = create_clinical_record(paciente_id, categoria, datos, professional.get("entidad_nombre", ""), request.data.get("node"))
        if result.get("success"):
            block = result.get("block", {})
            summary = {
                "id": f"BLOCK-{block.get('id', '')}-PACIENTE-{paciente_id}",
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "entidad_emisora": professional.get("entidad_nombre", ""),
                "paciente_id": paciente_id, "categoria": categoria, "datos": datos,
                "block_id": block.get("id"), "block_hash": block.get("hash"), "virtual": False,
            }
            histories = [h for h in read("historiales.json", []) if h.get("id") != summary["id"]]
            histories.append(summary)
            write("historiales.json", histories)
        return Response(result, status=201 if result.get("success") else 400)


class BlockchainStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({"success": True, **get_blockchain_status(request.query_params.get("node"))})


class BlockchainGenesisView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request):
        result = create_genesis(request.data.get("complexity", 4), request.data.get("proof_char", "0"), request.data.get("node"))
        return Response(result, status=201 if result.get("success") and result.get("created", True) else (200 if result.get("success") else 400))


class BlockchainBlocksView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({"success": True, "blocks": get_blocks(request.query_params.get("node"))})


class NodesView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({"success": True, "nodes": NodeService().list_nodes()})
    def post(self, request):
        try:
            node = NodeService().create(request.data.get("name"), request.data.get("ip", "127.0.0.1"), request.data.get("port"))
            return Response({"success": True, "node": node}, status=201)
        except Exception as error:
            return Response({"success": False, "message": str(error)}, status=400)


class NodeActionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request, node_name, action):
        try:
            service = NodeService()
            if action == "start":
                result = service.start(node_name, request.data.get("complexity", 4), request.data.get("proof_char", "0"))
            elif action == "stop":
                result = service.stop(node_name)
            else:
                return Response({"success": False, "message": "Acción inválida."}, status=400)
            return Response({"success": True, "node": result})
        except Exception as error:
            return Response({"success": False, "message": str(error)}, status=400)


class NodeDeleteView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def delete(self, request, node_name):
        try:
            NodeService().delete(node_name)
            return Response({"success": True})
        except Exception as error:
            return Response({"success": False, "message": str(error)}, status=400)
