import time

from .registro_clinico import RegistroClinico


class Bloque:
    def __init__(self, pId=-1, pPrevHash=None):
        self.id = pId
        self.time_stamp = int(time.time() * 1000)
        self.previous_hash = pPrevHash
        self.a_registros = []
        self.nonce = -1  # Aún no ha sido minado, por lo que no tiene nonce es -1
        self.hash = None  # Aún no ha sido minado, por lo que no tiene hash es None

    # Esto va a ser llamado desde la clase BlockChain, cuando se mine el bloque, para registrar el nonce y el hash del bloque
    def register(self, pNonce, pHash):
        if self.id > -1 and self.nonce < 0 and self.hash is None:
            self.nonce = pNonce
            self.hash = pHash
            return True
        return False

    # Recibe toda la información del registro clínico y lo agrega al bloque
    def set_registro_clinico(self, pEntidad, pPaciente, pCategoria, pDatosCifrados):
        self.a_registros.append(
            RegistroClinico(
                len(self.a_registros),
                pEntidad,
                pPaciente,
                pCategoria,
                pDatosCifrados,  # utilizamos len para asignar el id del registro
            )
        )

    # Recibe un objeto RegistroClinico y lo agrega al bloque
    def set_registro_obj(self, pReg):
        self.a_registros.append(
            RegistroClinico(
                len(self.a_registros),
                pReg.get_entidad_emisora(),
                pReg.get_paciente_id(),
                pReg.get_categoria(),
                pReg.get_datos_cifrados(),
            )
        )

    # Todos los métodos a continuación son getters para obtener información del bloque
    def get_registro(self, pId):
        return self.a_registros[pId]

    def count_registros(self):
        return len(self.a_registros)

    def get_id(self):
        return self.id

    def get_nonce(self):
        return self.nonce

    def get_hash(self):
        return self.hash

    def get_previous_hash(self):
        return self.previous_hash

    def to_string(self):
        sCad = str(self.id) + str(self.time_stamp) + str(self.previous_hash)
        for reg in self.a_registros:
            sCad += reg.to_string()
        return sCad

    # Método para serializar el bloque a diccionario (correctamente indentado dentro de la clase)
    def to_dict(self):
        return {
            "id": self.id,
            "previous_hash": self.previous_hash,
            "time_stamp": self.time_stamp,
            "nonce": self.nonce,
            "hash": self.hash,
            "a_registros": [reg.to_dict() for reg in self.a_registros],
        }
