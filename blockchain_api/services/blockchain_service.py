import json
from pathlib import Path

from ..motor_blockchain.bloque import Bloque
from ..motor_blockchain.cadena_bloques import BlockChain
from ..motor_blockchain.cifrado import Cifrado
from ..motor_blockchain.registro_clinico import RegistroClinico

# ============================================================
# CONFIGURACIÓN
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

BLOCKCHAIN_FILE = BASE_DIR / "data" / "blockchain.json"

# ============================================================
# UTILIDADES DE ARCHIVO
# ============================================================


def _ensure_data_directory():
    """
    Crea la carpeta data si todavía no existe.
    """
    BLOCKCHAIN_FILE.parent.mkdir(parents=True, exist_ok=True)


def _save_blockchain(blockchain):
    """
    Guarda la Blockchain completa en formato JSON.
    """
    _ensure_data_directory()

    with BLOCKCHAIN_FILE.open("w", encoding="utf-8") as file:
        json.dump(blockchain.to_dict(), file, ensure_ascii=False, indent=2)


def _load_data():
    """
    Lee blockchain.json.

    Si el archivo no existe, está vacío o tiene un JSON inválido,
    devuelve None.
    """

    if not BLOCKCHAIN_FILE.exists():
        return None

    try:
        with BLOCKCHAIN_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not data:
            return None

        if not data.get("chain"):
            return None

        return data

    except (json.JSONDecodeError, OSError):
        return None


# ============================================================
# ESTADO DE LA BLOCKCHAIN
# ============================================================


def blockchain_exists():
    """
    Determina si ya existe una Blockchain inicializada.
    """

    data = _load_data()

    return data is not None and len(data.get("chain", [])) > 0


def _get_validation_result(blockchain):
    """
    Compatible con las dos posibles versiones de is_chain_valid():

    Puede devolver:

        True / False

    o:

        (True, "La cadena es válida.")
    """

    result = blockchain.is_chain_valid()

    if isinstance(result, tuple):
        return result[0], result[1]

    if result:
        return True, "La cadena es válida."

    return False, "La cadena no es válida."


# ============================================================
# RECONSTRUIR BLOCKCHAIN DESDE JSON
# ============================================================


def _rebuild_blockchain(data):
    """
    Reconstruye el objeto BlockChain a partir del JSON almacenado.
    """

    complexity = int(data["complexity"])
    proof = data["proof_of_work"]
    proof_char = proof[0]

    blockchain = BlockChain(complexity, proof_char)

    # Limpiar la cadena creada por el constructor
    blockchain.block_chain = []

    # Reconstruir cada bloque
    for block_data in data.get("chain", []):

        block = Bloque(block_data.get("id", -1), block_data.get("previous_hash"))

        # Restaurar timestamp
        block.time_stamp = block_data.get("time_stamp", block.time_stamp)

        # Restaurar registros clínicos
        for record_data in block_data.get("a_registros", []):

            record = RegistroClinico(
                record_data.get("id", 0),
                record_data.get("entidad_emisora", ""),
                record_data.get("paciente_id", ""),
                record_data.get("categoria", ""),
                record_data.get("datos_cifrados", ""),
            )

            # Restaurar timestamp original
            record.time_stamp = record_data.get("time_stamp", record.time_stamp)

            block.a_registros.append(record)

        # Restaurar nonce
        block.nonce = block_data.get("nonce", -1)

        # Restaurar hash
        block.hash = block_data.get("hash")

        blockchain.block_chain.append(block)

    return blockchain


# ============================================================
# CREAR GENESIS
# ============================================================


def create_genesis(complexity, proof_char):
    """
    Crea el bloque Genesis utilizando el motor Blockchain
    del primer parcial.

    El Genesis se crea una sola vez.
    """

    try:

        if isinstance(complexity, bool):
            raise ValueError("La complejidad debe ser un número entero.")

        if isinstance(complexity, float) and not complexity.is_integer():
            raise ValueError("La complejidad debe ser un número entero.")

        complexity = int(complexity)

        if complexity < 1:
            raise ValueError("La complejidad debe ser mayor o igual a 1.")

        if complexity > 6:
            raise ValueError("La complejidad máxima permitida es 6.")

        if not isinstance(proof_char, str) or len(proof_char) != 1:
            raise ValueError(
                "El carácter de prueba de trabajo debe ser exactamente un carácter."
            )

        if not proof_char.strip():
            raise ValueError("El carácter de prueba de trabajo no puede estar vacío.")

        if blockchain_exists():

            return {
                "success": False,
                "message": "La Blockchain ya está inicializada.",
                "status": get_blockchain_status(),
            }

        # Crear instancia del motor original
        blockchain = BlockChain(complexity, proof_char)

        # Crear Genesis utilizando el método original
        creado = blockchain.create_genesis()

        if not creado:

            return {
                "success": False,
                "message": "No fue posible crear el bloque Genesis.",
            }

        # El Genesis es el primer bloque de la cadena
        genesis = blockchain.block_chain[0]

        # Validar Blockchain
        valid, validation_message = _get_validation_result(blockchain)

        if not valid:

            return {"success": False, "message": validation_message}

        # Guardar Blockchain
        _save_blockchain(blockchain)

        return {
            "success": True,
            "message": ("Bloque Genesis creado y minado correctamente."),
            "status": get_blockchain_status(),
        }

    except Exception as error:

        return {"success": False, "message": (f"Error al crear Genesis: {error!s}")}


# ============================================================
# ESTADO DE LA BLOCKCHAIN
# ============================================================


def get_blockchain_status():

    data = _load_data()

    # Blockchain todavía no inicializada
    if not data:

        return {
            "initialized": False,
            "valid": False,
            "blocks": 0,
            "complexity": None,
            "proof_of_work": "",
            "genesis": None,
            "message": ("La Blockchain todavía " "no ha sido inicializada."),
        }

    try:

        blockchain = _rebuild_blockchain(data)

        # Validar cadena
        valid, validation_message = _get_validation_result(blockchain)

        genesis = None

        if len(blockchain.block_chain) > 0:

            genesis = blockchain.block_chain[0].to_dict()

        return {
            "initialized": True,
            "valid": valid,
            "validation_message": validation_message,
            "blocks": len(blockchain.block_chain),
            "complexity": blockchain.complexity,
            "proof_of_work": blockchain.proof_of_work,
            "genesis": genesis,
            "message": "Blockchain activa.",
        }

    except Exception as error:

        return {
            "initialized": False,
            "valid": False,
            "blocks": 0,
            "complexity": None,
            "proof_of_work": "",
            "genesis": None,
            "message": (f"Error leyendo Blockchain: {error}"),
        }


# ============================================================
# OBTENER BLOQUES
# ============================================================


def get_blocks():

    data = _load_data()

    if not data:
        return []

    return data.get("chain", [])


# ============================================================
# HISTORIAL DE PACIENTE
# ============================================================


def get_patient_history(paciente_id):

    data = _load_data()

    if not data:
        return []

    blockchain = _rebuild_blockchain(data)

    historial = blockchain.get_historial_paciente(paciente_id)

    resultado = []

    for registro in historial:

        datos = {}

        try:

            # Misma lógica de cifrado utilizada
            # en tester_consola.py
            clave = "clave_" + paciente_id.lower()

            motor_cifrado = Cifrado(clave)

            texto = motor_cifrado.desencriptar(registro.get_datos_cifrados())

            if texto:

                datos = json.loads(texto)

        except Exception:

            datos = {}

        resultado.append(
            {
                "id": registro.get_id(),
                "timestamp": registro.get_time_stamp(),
                "entidad_emisora": (registro.get_entidad_emisora()),
                "paciente_id": (registro.get_paciente_id()),
                "categoria": (registro.get_categoria()),
                "datos": datos,
            }
        )

    return resultado


# ============================================================
# CREAR REGISTRO CLÍNICO
# ============================================================


def create_clinical_record(paciente_id, categoria, datos_clinicos, entidad_emisora):

    data = _load_data()

    if not data:

        return {
            "success": False,
            "message": ("La Blockchain todavía " "no ha sido inicializada."),
        }

    try:

        # Reconstruir Blockchain
        blockchain = _rebuild_blockchain(data)

        # ----------------------------------------------------
        # CONVERTIR DATOS CLÍNICOS A JSON
        # ----------------------------------------------------

        texto_plano = json.dumps(datos_clinicos, ensure_ascii=False)

        # ----------------------------------------------------
        # CIFRAR DATOS
        # ----------------------------------------------------

        llave_paciente = "clave_" + paciente_id.lower()

        motor_cifrado = Cifrado(llave_paciente)

        datos_cifrados = motor_cifrado.encriptar(texto_plano)

        if not datos_cifrados:

            return {
                "success": False,
                "message": ("No fue posible cifrar " "el registro clínico."),
            }

        # ----------------------------------------------------
        # CREAR NUEVO BLOQUE
        # ----------------------------------------------------

        blockchain.create_block()

        # El último bloque creado
        ultimo = blockchain.block_chain[-1]

        # ----------------------------------------------------
        # AGREGAR REGISTRO CLÍNICO
        # ----------------------------------------------------

        ultimo.set_registro_clinico(
            entidad_emisora, paciente_id, categoria, datos_cifrados
        )

        # ----------------------------------------------------
        # MINAR BLOQUE
        # ----------------------------------------------------

        blockchain.mine_block()

        # ----------------------------------------------------
        # VALIDAR CADENA
        # ----------------------------------------------------

        valid, validation_message = _get_validation_result(blockchain)

        if not valid:

            return {"success": False, "message": validation_message}

        # ----------------------------------------------------
        # GUARDAR BLOCKCHAIN
        # ----------------------------------------------------

        _save_blockchain(blockchain)

        return {
            "success": True,
            "message": ("Registro clínico agregado " "y bloque minado correctamente."),
            "block": ultimo.to_dict(),
            "validation": validation_message,
        }

    except Exception as error:

        return {"success": False, "message": (f"Error al crear registro: {error}")}
