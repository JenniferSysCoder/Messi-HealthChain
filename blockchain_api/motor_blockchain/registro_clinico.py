import time


class RegistroClinico:
    def __init__(self, pId, pEntidad, pPaciente, pCategoria, pDatosCifrados):
        self.id = pId
        self.time_stamp = int(time.time() * 1000)
        self.entidad_emisora = pEntidad
        self.paciente_id = pPaciente
        self.categoria = pCategoria
        self.datos_cifrados = pDatosCifrados

    # Retorna una representación en cadena del registro clínico, concatenando sus atributos
    def to_string(self):
        return (
            str(self.id)
            + str(self.time_stamp)
            + self.entidad_emisora
            + self.paciente_id
            + self.categoria
            + self.datos_cifrados
        )

    # Todos estos getters son necesarios para poder acceder a los atributos del registro clínico desde la clase Bloque y desde la clase BlockChain, ya que los atributos son privados y no se pueden acceder directamente desde fuera de la clase RegistroClinico.
    def get_id(self):
        return self.id

    def get_time_stamp(self):
        return self.time_stamp

    def get_entidad_emisora(self):
        return self.entidad_emisora

    def get_paciente_id(self):
        return self.paciente_id

    def get_categoria(self):
        return self.categoria

    def get_datos_cifrados(self):
        return self.datos_cifrados

    # Método para serializar a diccionario (correctamente indentado dentro de la clase)
    def to_dict(self):
        return {
            "id": self.id,
            "time_stamp": self.time_stamp,
            "entidad_emisora": self.entidad_emisora,
            "paciente_id": self.paciente_id,
            "categoria": self.categoria,
            "datos_cifrados": self.datos_cifrados,
        }
