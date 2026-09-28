import hashlib

from ..authentication import create_token
from ..repositories.json_repository import read


def hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verificar_password(password, password_almacenada):
    """
    Verifica una contraseña contra el hash almacenado.
    """

    if not password_almacenada:
        return False

    password_hash = hash_password(password)

    return password_hash == password_almacenada


def find_user(username):

    usuarios = read("usuarios.json", [])

    for usuario in usuarios:

        if usuario.get("username") == username:
            return usuario

    return None


def authenticate(username, password):

    usuario = find_user(username)

    if not usuario:
        return None

    if usuario.get("activo", True) is False:
        return None

    # Compatibilidad con usuarios que tengan
    # "password" o "password_hash".
    password_almacenada = usuario.get("password_hash") or usuario.get("password")

    if not verificar_password(password, password_almacenada):
        return None

    token = create_token(usuario)

    return usuario, token
