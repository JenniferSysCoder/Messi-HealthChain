from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import JWTAuthentication
from .nodes.node_manager import NodeManager
from .repositories.json_repository import read, write
from .services.auth_service import authenticate
from .services.blockchain_service import (
    create_clinical_record,
    create_genesis,
    get_blockchain_status,
    get_blocks,
    get_patient_history,
)
from .services.node_service import NodeService


def _serialize_user(usuario):
    if not usuario:
        return None
    return {
        "username": usuario.get("username"),
        "nombre": usuario.get("nombre"),
        "rol": usuario.get("rol"),
        "jvpm": usuario.get("jvpm"),
        "entidad_id": usuario.get("entidad_id"),
        "entidad_nombre": usuario.get("entidad_nombre"),
        "paciente_id": usuario.get("paciente_id"),
    }


def _require_role(request, roles):
    return getattr(request.user, "is_authenticated", False) and getattr(request.user, "rol", None) in roles


def _patient_history_record(patient):
    return {
        "id": f"PACIENTE-{patient.get('id')}",
        "timestamp": patient.get("fecha_registro", ""),
        "entidad_emisora": "Registro de paciente",
        "paciente_id": patient.get("id", ""),
        "categoria": "REGISTRO_PACIENTE",
        "datos": {
            "nombre": patient.get("nombre", ""),
            "dui": patient.get("dui", ""),
            "fecha_nacimiento": patient.get("fecha_nacimiento", ""),
            "tipo_sangre": patient.get("tipo_sangre", ""),
            "alergias": patient.get("alergias", ""),
            "vacunas": patient.get("vacunas", ""),
            "cronicas": patient.get("cronicas", ""),
            "telefono": patient.get("telefono", ""),
            "direccion": patient.get("direccion", ""),
        },
        "block_id": None,
        "block_hash": None,
        "virtual": True,
    }


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = str(request.data.get("username", "")).strip()
        password = str(request.data.get("password", ""))
        if not username or not password:
            return Response({"success": False, "message": "Debe proporcionar usuario y contraseña."}, status=400)
        result = authenticate(username, password)
        if result is None:
            return Response({"success": False, "message": "Usuario o contraseña incorrectos."}, status=401)
        user, token = result
        return Response({"success": True, "token": token, "usuario": _serialize_user(user)}, status=200)


class PerfilView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        return Response({"success": True, "usuario": _serialize_user(vars(request.user))})


class BlockchainStatusView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede consultar el estado técnico de la Blockchain."}, status=403)
        return Response({"success": True, **get_blockchain_status(request.query_params.get("node"))})


class BlockchainGenesisView(APIView):
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede inicializar la Blockchain."}, status=403)
        complexity = request.data.get("complexity", 4)
        proof_char = request.data.get("proof_char", "0")
        node = request.data.get("node")
        result = create_genesis(complexity, proof_char, node)
        if result.get("success"):
            return Response(result, status=201 if result.get("created", True) else 200)
        return Response(result, status=400)


class BlockchainBlocksView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede consultar los bloques de la Blockchain."}, status=403)
        return Response({"success": True, "blocks": get_blocks(request.query_params.get("node"))})


class PacientesView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        role = getattr(request.user, "rol", None)
        if role == "PACIENTE":
            patients = [p for p in read("pacientes.json", []) if p.get("id") == getattr(request.user, "paciente_id", None)]
        elif role in ["ADMIN", "PROFESIONAL"]:
            patients = read("pacientes.json", [])
        else:
            return Response({"success": False, "message": "No autorizado."}, status=403)
        return Response({"success": True, "pacientes": patients})

    def post(self, request):
        if getattr(request.user, "rol", None) != "PROFESIONAL":
            return Response({"success": False, "message": "Solo los profesionales pueden registrar pacientes."}, status=403)

        required = ["nombre", "dui", "fecha_nacimiento", "tipo_sangre", "alergias", "vacunas", "cronicas"]
        data = {key: str(request.data.get(key, "")).strip() for key in required}
        if any(not value for value in data.values()):
            return Response({"success": False, "message": "Nombre, DUI, fecha de nacimiento, tipo de sangre, alergias, vacunas y enfermedades crónicas son obligatorios."}, status=400)

        patients = read("pacientes.json", [])
        if any(p.get("dui") == data["dui"] for p in patients):
            return Response({"success": False, "message": "Ya existe un paciente con ese DUI."}, status=409)

        numeric_ids = []
        for patient in patients:
            value = str(patient.get("id", ""))
            if value.startswith("P") and value[1:].isdigit():
                numeric_ids.append(int(value[1:]))
        next_id = max(numeric_ids, default=0) + 1

        patient = {
            "id": f"P{next_id:03d}",
            "nombre": data["nombre"],
            "dui": data["dui"],
            "fecha_nacimiento": data["fecha_nacimiento"],
            "tipo_sangre": data["tipo_sangre"],
            "alergias": data["alergias"],
            "vacunas": data["vacunas"],
            "cronicas": data["cronicas"],
            "telefono": str(request.data.get("telefono", "")).strip(),
            "direccion": str(request.data.get("direccion", "")).strip(),
            "fecha_registro": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "estado": "ACTIVO",
        }
        from datetime import datetime
        patient["fecha_registro"] = datetime.now().isoformat(timespec="seconds")
        patients.append(patient)
        write("pacientes.json", patients)

        # La ficha del paciente queda persistida en JSON, pero NO genera un bloque.
        # Los bloques se reservan para eventos clínicos creados por un profesional.
        history_record = _patient_history_record(patient)
        histories = read("historiales.json", [])
        histories = [h for h in histories if not (h.get("paciente_id") == patient["id"] and h.get("virtual"))]
        histories.append(history_record)
        write("historiales.json", histories)

        return Response({"success": True, "paciente": patient, "history_record": history_record}, status=201)


class PacienteHistorialView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request, paciente_id):
        role = getattr(request.user, "rol", None)
        if role == "PACIENTE" and getattr(request.user, "paciente_id", None) != paciente_id:
            return Response({"success": False, "message": "Solo puede consultar su propio historial."}, status=403)
        if role not in ["ADMIN", "PROFESIONAL", "PACIENTE"]:
            return Response({"success": False, "message": "No autorizado."}, status=403)
        result = get_patient_history(paciente_id, request.query_params.get("node"))
        patient = next((p for p in read("pacientes.json", []) if p.get("id") == paciente_id), None)
        if not result:
            histories = read("historiales.json", [])
            result = [h for h in histories if h.get("paciente_id") == paciente_id]
        if not result and patient:
            result = [_patient_history_record(patient)]
        return Response({"success": True, "paciente_id": paciente_id, "historial": result, "paciente": patient})


class RegistroClinicoView(APIView):
    authentication_classes = [JWTAuthentication]

    def post(self, request):
        user = request.user
        if getattr(user, "rol", None) != "PROFESIONAL":
            return Response({"success": False, "message": "Solo los profesionales pueden crear registros clínicos."}, status=403)
        if not getattr(user, "jvpm", None):
            return Response({"success": False, "message": "El profesional no tiene JVPM."}, status=403)
        paciente_id = str(request.data.get("paciente_id", "")).strip()
        categoria = str(request.data.get("categoria", "")).strip()
        datos = request.data.get("datos", {})
        if not paciente_id or not categoria or not isinstance(datos, dict):
            return Response({"success": False, "message": "Paciente, categoría y datos clínicos son obligatorios."}, status=400)
        paciente = next((p for p in read("pacientes.json", []) if p.get("id") == paciente_id), None)
        if not paciente:
            return Response({"success": False, "message": "El paciente no está registrado."}, status=404)
        datos["nombre"] = paciente.get("nombre", datos.get("nombre", ""))
        # La ficha del paciente aporta antecedentes; el profesional registra el evento clínico.
        datos.setdefault("tipo_sangre", paciente.get("tipo_sangre", ""))
        datos.setdefault("alergias", paciente.get("alergias", ""))
        datos.setdefault("vacunas", paciente.get("vacunas", ""))
        datos.setdefault("cronicas", paciente.get("cronicas", ""))
        required = ["diagnostico", "tratamiento", "observaciones"]
        missing = [field for field in required if not str(datos.get(field, "")).strip()]
        if missing:
            return Response({"success": False, "message": "Faltan campos clínicos: " + ", ".join(missing)}, status=400)
        result = create_clinical_record(
            paciente_id,
            categoria,
            datos,
            getattr(user, "entidad_nombre", ""),
            request.data.get("node"),
        )
        if result.get("success"):
            block = result.get("block", {})
            record_summary = {
                "id": f"BLOCK-{block.get('id', '')}-PACIENTE-{paciente_id}",
                "timestamp": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
                "entidad_emisora": getattr(user, "entidad_nombre", ""),
                "paciente_id": paciente_id,
                "categoria": categoria,
                "datos": datos,
                "block_id": block.get("id"),
                "block_hash": block.get("hash"),
                "virtual": False,
            }
            histories = read("historiales.json", [])
            histories = [h for h in histories if h.get("id") != record_summary["id"]]
            histories.append(record_summary)
            write("historiales.json", histories)
        return Response(result, status=201 if result.get("success") else 400)


class NodesView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede consultar la infraestructura de nodos."}, status=403)
        return Response({"success": True, "nodes": NodeService().list_nodes()})

    def post(self, request):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede crear nodos."}, status=403)
        try:
            node = NodeService().create(request.data.get("name"), request.data.get("ip", "127.0.0.1"), request.data.get("port"))
            return Response({"success": True, "node": node}, status=201)
        except Exception as error:
            return Response({"success": False, "message": str(error)}, status=400)


class NodeActionView(APIView):
    authentication_classes = [JWTAuthentication]

    def post(self, request, node_name, action):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede administrar servidores."}, status=403)
        service = NodeService()
        try:
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
    authentication_classes = [JWTAuthentication]

    def delete(self, request, node_name):
        if not _require_role(request, ["ADMIN"]):
            return Response({"success": False, "message": "Solo ADMIN puede eliminar nodos."}, status=403)
        try:
            NodeService().delete(node_name)
            return Response({"success": True})
        except Exception as error:
            return Response({"success": False, "message": str(error)}, status=400)
