from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import JWTAuthentication
from .repositories.json_repository import read
from .services.auth_service import authenticate
from .services.blockchain_service import (
    create_clinical_record,
    create_genesis,
    get_blockchain_status,
    get_blocks,
    get_patient_history,
)


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


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================


def _get_authenticated_user(request):
    """
    Devuelve el usuario autenticado mediante JWT.
    """
    return request.user


def _require_role(request, roles):
    """
    Verifica que el usuario tenga uno de los roles permitidos.
    """

    user = _get_authenticated_user(request)

    if not getattr(user, "is_authenticated", False):
        return False

    return getattr(user, "rol", None) in roles


# ============================================================
# LOGIN
# ============================================================


class LoginView(APIView):
    """
    Inicio de sesión de HealthChain.
    """

    permission_classes = [AllowAny]

    def post(self, request):

        username = str(request.data.get("username", "")).strip()

        password = str(request.data.get("password", ""))

        if not username or not password:

            return Response(
                {
                    "success": False,
                    "message": ("Debe proporcionar usuario " "y contraseña."),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # AUTENTICAR USUARIO
        # ----------------------------------------------------

        resultado = authenticate(username, password)

        if resultado is None:

            return Response(
                {
                    "success": False,
                    "message": ("Usuario o contraseña incorrectos."),
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        usuario, token = resultado

        # ----------------------------------------------------
        # RESPUESTA
        # ----------------------------------------------------

        return Response(
            {
                "success": True,
                "message": "Inicio de sesión correcto.",
                "token": token,
                "usuario": _serialize_user(usuario),
            },
            status=status.HTTP_200_OK,
        )


class PerfilView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(self, request):
        user = request.user

        if not getattr(user, "is_authenticated", False):
            return Response(
                {
                    "success": False,
                    "message": "No autenticado.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        payload = {
            "username": getattr(user, "username", None),
            "nombre": getattr(user, "nombre", None),
            "rol": getattr(user, "rol", None),
            "jvpm": getattr(user, "jvpm", None),
            "entidad_id": getattr(user, "entidad_id", None),
            "entidad_nombre": getattr(user, "entidad_nombre", None),
            "paciente_id": getattr(user, "paciente_id", None),
        }

        return Response(
            {
                "success": True,
                "usuario": payload,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# ESTADO DE BLOCKCHAIN
# ============================================================


class BlockchainStatusView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(self, request):

        if not _require_role(
            request,
            [
                "ADMIN",
                "PROFESIONAL",
                "PACIENTE",
            ],
        ):

            return Response(
                {
                    "success": False,
                    "message": "No autorizado.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            get_blockchain_status(),
            status=status.HTTP_200_OK,
        )


# ============================================================
# GENESIS
# ============================================================


class BlockchainGenesisView(APIView):

    authentication_classes = [JWTAuthentication]

    def post(self, request):

        # Solo ADMIN puede inicializar Blockchain
        if not _require_role(
            request,
            ["ADMIN"],
        ):

            return Response(
                {
                    "success": False,
                    "message": (
                        "Solo un administrador " "puede inicializar la Blockchain."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        complexity = request.data.get(
            "complexity",
            4,
        )

        proof_char = request.data.get(
            "proof_char",
            "0",
        )

        resultado = create_genesis(
            complexity=complexity,
            proof_char=proof_char,
        )

        if resultado.get("success"):

            return Response(
                resultado,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            resultado,
            status=status.HTTP_400_BAD_REQUEST,
        )


# ============================================================
# BLOQUES
# ============================================================


class BlockchainBlocksView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(self, request):

        if not _require_role(
            request,
            [
                "ADMIN",
                "PROFESIONAL",
            ],
        ):

            return Response(
                {
                    "success": False,
                    "message": "No autorizado.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(
            {
                "success": True,
                "blocks": get_blocks(),
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# PACIENTES
# ============================================================


class PacientesView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(self, request):

        if not _require_role(
            request,
            [
                "ADMIN",
                "PROFESIONAL",
            ],
        ):

            return Response(
                {
                    "success": False,
                    "message": "No autorizado.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        pacientes = read(
            "pacientes.json",
            [],
        )

        return Response(
            {
                "success": True,
                "pacientes": pacientes,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# HISTORIAL DE PACIENTE
# ============================================================


class PacienteHistorialView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(
        self,
        request,
        paciente_id,
    ):

        user = request.user

        rol = getattr(
            user,
            "rol",
            None,
        )

        # ----------------------------------------------------
        # PACIENTE SOLO PUEDE CONSULTAR SU HISTORIAL
        # ----------------------------------------------------

        if rol == "PACIENTE":

            if (
                getattr(
                    user,
                    "paciente_id",
                    None,
                )
                != paciente_id
            ):

                return Response(
                    {
                        "success": False,
                        "message": (
                            "Un paciente solo puede " "consultar su propio historial."
                        ),
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

        elif rol not in [
            "ADMIN",
            "PROFESIONAL",
        ]:

            return Response(
                {
                    "success": False,
                    "message": "No autorizado.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        historial = get_patient_history(paciente_id)

        return Response(
            {
                "success": True,
                "paciente_id": paciente_id,
                "historial": historial,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================
# REGISTRO CLÍNICO
# ============================================================


class RegistroClinicoView(APIView):

    authentication_classes = [JWTAuthentication]

    def post(self, request):

        user = request.user

        # ----------------------------------------------------
        # SOLO PROFESIONALES
        # ----------------------------------------------------

        if (
            getattr(
                user,
                "rol",
                None,
            )
            != "PROFESIONAL"
        ):

            return Response(
                {
                    "success": False,
                    "message": (
                        "Solo los profesionales autorizados "
                        "pueden crear registros clínicos."
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ----------------------------------------------------
        # VALIDAR JVPM
        # ----------------------------------------------------

        jvpm = getattr(
            user,
            "jvpm",
            None,
        )

        if not jvpm:

            return Response(
                {
                    "success": False,
                    "message": ("El profesional no tiene " "un JVPM válido."),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # ----------------------------------------------------
        # ENTIDAD DEL PROFESIONAL
        # ----------------------------------------------------

        entidad_emisora = getattr(
            user,
            "entidad_nombre",
            None,
        )

        if not entidad_emisora:

            return Response(
                {
                    "success": False,
                    "message": ("El profesional no tiene " "una entidad asociada."),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # DATOS DEL REGISTRO
        # ----------------------------------------------------

        paciente_id = str(
            request.data.get(
                "paciente_id",
                "",
            )
        ).strip()

        categoria = str(
            request.data.get(
                "categoria",
                "",
            )
        ).strip()

        datos_clinicos = request.data.get(
            "datos",
            {},
        )

        if not paciente_id:

            return Response(
                {
                    "success": False,
                    "message": ("Debe especificar el paciente."),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not categoria:

            return Response(
                {
                    "success": False,
                    "message": ("Debe especificar la categoría."),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(
            datos_clinicos,
            dict,
        ):

            return Response(
                {
                    "success": False,
                    "message": (
                        "Los datos clínicos deben " "enviarse como objeto JSON."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # VERIFICAR PACIENTE
        # ----------------------------------------------------

        pacientes = read(
            "pacientes.json",
            [],
        )

        paciente = None

        for item in pacientes:

            if (
                str(
                    item.get(
                        "id",
                        "",
                    )
                )
                == paciente_id
            ):

                paciente = item
                break

        if paciente is None:

            return Response(
                {
                    "success": False,
                    "message": ("El paciente no está registrado."),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # ----------------------------------------------------
        # VALIDACIÓN DEL NOMBRE
        # ----------------------------------------------------

        nombre_paciente = paciente.get(
            "nombre",
            "",
        )

        nombre_datos = datos_clinicos.get(
            "nombre",
            "",
        )

        if nombre_datos and nombre_paciente and nombre_datos != nombre_paciente:

            return Response(
                {
                    "success": False,
                    "message": (
                        "El nombre del paciente " "no coincide con el registro."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ----------------------------------------------------
        # CREAR REGISTRO EN BLOCKCHAIN
        # ----------------------------------------------------

        resultado = create_clinical_record(
            paciente_id=paciente_id,
            categoria=categoria,
            datos_clinicos=datos_clinicos,
            entidad_emisora=entidad_emisora,
        )

        if resultado.get("success"):

            return Response(
                resultado,
                status=status.HTTP_201_CREATED,
            )

        return Response(
            resultado,
            status=status.HTTP_400_BAD_REQUEST,
        )
