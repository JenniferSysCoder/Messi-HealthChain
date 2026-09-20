from .bloque import Bloque
from .sha256 import SHA256


class BlockChain:
    def __init__(self, iComplexity, proofChar):
        self.block_chain = []  # Lista que almacena los bloques de la cadena de bloques
        self.complexity = iComplexity  # Nivel de dificultad de la minería (1-6)
        self.proof_of_work = (
            proofChar * self.complexity
        )  # Carácter de prueba de trabajo (ej: "0000" para complejidad 4)

    # Retorna la lista de bloques de la cadena de bloques
    def get_block_chain(self):
        return self.block_chain

    # Observa si un bloque con el mismo ID ya existe en la cadena de bloques
    def block_exist(self, blk):
        for block in self.block_chain:
            if block.get_id() == blk.get_id():
                return True
        return False

    # Retorna el bloque en la posición index de la cadena de bloques
    def get_block(self, index):
        return self.block_chain[index]

    # Retorna el último bloque de la cadena de bloques
    def get_last_block(self):
        return self.block_chain[-1]

    # Retorna el tamaño de la cadena de bloques
    def size(self):
        return len(self.block_chain)

    def create_genesis_with_record(self, pEntidad, pPaciente):
        if self.size() < 1:
            tmp_block = Bloque(
                0, "0000000000000000000000000000000000000000000000000000000000000000"
            )
            # Agregamos un registro clínico inicial al bloque génesis para indicar que se ha creado el historial del paciente
            tmp_block.set_registro_clinico(
                "0000GeNeSiS", pPaciente, "INICIO", "HISTORIAL_CREADO"
            )
            self.block_chain.append(tmp_block)
            self.mine_block()
            return True
        return False

    # Crea el bloque génesis sin registros clínicos
    def create_genesis(self):
        if self.size() < 1:
            tmp_block = Bloque(
                0, "0000000000000000000000000000000000000000000000000000000000000000"
            )
            self.block_chain.append(tmp_block)
            self.mine_block()
            return True
        return False

    # Crea un nuevo bloque y lo agrega a la cadena de bloques
    def create_block(self):
        prev_hash = self.block_chain[-1].get_hash()
        self.block_chain.append(Bloque(self.size(), prev_hash))

    # Retorna el historial completo de registros clínicos de un paciente específico
    def get_historial_paciente(self, pPaciente):
        historial = []
        for block in self.block_chain:
            for j in range(block.count_registros()):
                reg = block.get_registro(j)
                if reg.get_paciente_id() == pPaciente:
                    historial.append(reg)
        return historial

    # Valida la prueba de trabajo de un bloque específico comparando su hash calculado con el hash almacenado en el bloque
    def get_proof_of_work_over_block(self, blk):
        cad = blk.to_string()
        nonce = blk.get_nonce()
        sHash = self.generate_hash(cad + str(nonce))
        return sHash == blk.get_hash()

    # Agrega un bloque a la cadena de bloques si no existe y si su prueba de trabajo es válida
    def add_proved_block(self, blk):
        if not self.block_exist(blk) and self.get_proof_of_work_over_block(blk):
            self.block_chain.append(blk)
            return True
        return False

    # Acá se realiza la minería del bloque actual, buscando un nonce que genere un hash válido según la dificultad configurada
    def mine_block(self):
        bloque_actual = self.block_chain[
            -1
        ]  # Obtenemos el último bloque de la cadena para minarlo
        cad = bloque_actual.to_string()
        nonce = 0
        sHash = ""
        while True:
            sHash = self.generate_hash(cad + str(nonce))
            if sHash[: self.complexity] == self.proof_of_work:
                bloque_actual.register(nonce, sHash)
                break
            nonce += 1

    def generate_hash(self, pCad):
        try:
            return SHA256.generate_hash(pCad)
        except Exception:  # noqa: BLE001
            return None

    # Acá se genera un reporte de los registros clínicos contenidos en un bloque específico.
    def registro_report(self, nBlock):
        sCad = ""
        blk = self.block_chain[nBlock]
        for i in range(blk.count_registros()):
            reg = blk.get_registro(i)
            sCad += f"\tRegistro #{reg.get_id()}: {reg.get_categoria()}.\t({reg.get_entidad_emisora()} ---> {reg.get_paciente_id()})\n"
        return sCad

    # Acá se convierte la cadena de bloques a una cadena de texto para su representación
    def to_string(self):
        block_chain_str = ""
        for block in self.block_chain:
            block_chain_str += block.to_string() + "\n"
        return block_chain_str

    def is_chain_valid(self):
        """
        Valida la integridad completa de la cadena de bloques.

        Verifica, para cada bloque:
        1. Que su hash sea consistente con su contenido y su nonce
           (prueba de trabajo correcta).
        2. Que su hash cumpla con la dificultad configurada
           (self.proof_of_work).
        3. Que su previous_hash coincida exactamente con el hash real
           del bloque anterior en la cadena (esto es lo que realmente
           "encadena" los bloques; sin esto, alguien podría alterar un
           bloque intermedio sin que se detecte).
        """
        if self.size() == 0:
            return False, "La cadena está vacía."

        for i, block in enumerate(self.block_chain):
            # 1. La prueba de trabajo del bloque debe ser consistente
            #    (el hash guardado debe corresponder a su contenido + nonce)
            if not self.get_proof_of_work_over_block(block):
                return (
                    False,
                    f"Bloque {block.get_id()} (índice {i}): el hash no corresponde a su contenido/nonce.",
                )

            # 2. El hash debe cumplir con la dificultad configurada
            if (
                block.get_hash() is None
                or block.get_hash()[: self.complexity] != self.proof_of_work
            ):
                return (
                    False,
                    f"Bloque {block.get_id()} (índice {i}): el hash no cumple la dificultad requerida.",
                )

            # 3. El encadenamiento con el bloque anterior debe ser correcto
            if i > 0:
                bloque_anterior = self.block_chain[i - 1]
                if block.get_previous_hash() != bloque_anterior.get_hash():
                    return False, (
                        f"Bloque {block.get_id()} (índice {i}): previous_hash no coincide "
                        f"con el hash real del bloque anterior (posible alteración)."
                    )

        return True, "La cadena es válida."

    # Método para serializar toda la cadena al archivo JSON
    def to_dict(self):
        return {
            "complexity": self.complexity,
            "proof_of_work": self.proof_of_work,
            "chain": [b.to_dict() for b in self.block_chain],
        }
