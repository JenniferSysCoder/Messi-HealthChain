import hashlib

from ..authentication import create_token
from ..repositories.json_repository import read


def hash_password(password):

    return hashlib.sha256(password.encode("utf-8")).hexdigest()


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

    password_hash = hash_password(password)

    if usuario.get("password_hash") != password_hash:

        return None

    token = create_token(usuario)

    return usuario, token
