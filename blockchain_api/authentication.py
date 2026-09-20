import base64
import hashlib
import hmac
import json
import time

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


def _secret():
    return settings.SECRET_KEY.encode("utf-8")


def _b64encode(data):
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data):
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("utf-8"))


def create_token(usuario):
    payload = {
        "username": usuario.get("username"),
        "nombre": usuario.get("nombre"),
        "rol": usuario.get("rol"),
        "jvpm": usuario.get("jvpm"),
        "entidad_id": usuario.get("entidad_id"),
        "entidad_nombre": usuario.get("entidad_nombre"),
        "iat": int(time.time()),
    }

    header = {
        "alg": "HS256",
        "typ": "JWT",
    }

    header_encoded = _b64encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )

    payload_encoded = _b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )

    message = f"{header_encoded}.{payload_encoded}"

    signature = hmac.new(_secret(), message.encode("utf-8"), hashlib.sha256).digest()

    signature_encoded = _b64encode(signature)

    return f"{message}.{signature_encoded}"


def decode_token(token):
    try:
        parts = token.split(".")

        if len(parts) != 3:
            return None

        header_encoded = parts[0]
        payload_encoded = parts[1]
        signature_encoded = parts[2]

        message = f"{header_encoded}.{payload_encoded}"

        expected_signature = hmac.new(
            _secret(), message.encode("utf-8"), hashlib.sha256
        ).digest()

        expected_signature_encoded = _b64encode(expected_signature)

        if not hmac.compare_digest(signature_encoded, expected_signature_encoded):
            return None

        payload = json.loads(_b64decode(payload_encoded).decode("utf-8"))

        return payload

    except Exception:
        return None


class HealthChainUser:

    def __init__(self, payload):
        self.username = payload.get("username")
        self.nombre = payload.get("nombre")
        self.rol = payload.get("rol")
        self.jvpm = payload.get("jvpm")
        self.entidad_id = payload.get("entidad_id")
        self.entidad_nombre = payload.get("entidad_nombre")

        self.is_authenticated = True
        self.is_anonymous = False

    def __str__(self):
        return self.username or ""


class JWTAuthentication(BaseAuthentication):

    def authenticate(self, request):

        authorization = request.headers.get("Authorization")

        if not authorization:
            return None

        parts = authorization.split()

        if len(parts) != 2:
            raise AuthenticationFailed("Formato de autorización inválido.")

        if parts[0].lower() != "bearer":
            raise AuthenticationFailed("Debe utilizar Bearer Token.")

        token = parts[1]

        payload = decode_token(token)

        if not payload:
            raise AuthenticationFailed("Token inválido.")

        username = payload.get("username")

        if not username:
            raise AuthenticationFailed("El token no contiene usuario.")

        user = HealthChainUser(payload)

        return user, token
