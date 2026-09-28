from .client import NodeClient


class Wallet:
    """Cliente lógico equivalente a frmWallet."""

    def __init__(self, node, timeout=8):
        self.node = node
        self.client = NodeClient(timeout=timeout)

    def ping(self):
        return self.client.ping(self.node)

    def status(self):
        return self.client.get_status(self.node)

    def blocks(self):
        return self.client.get_blocks(self.node)

    def history(self, patient_id):
        return self.client.get_history(self.node, patient_id)

    def create_genesis(self):
        return self.client.create_genesis(self.node)

    def create_record(self, paciente_id, categoria, datos_cifrados, entidad_emisora):
        return self.client.create_record(
            self.node, paciente_id, categoria, datos_cifrados, entidad_emisora
        )
