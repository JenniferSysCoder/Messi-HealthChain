from ..motor_blockchain.cifrado import Cifrado
from ..nodes.client import NodeClient
from ..nodes.node_manager import NodeManager
from ..nodes.wallet import Wallet
from ..motor_blockchain.datos_nodo import NodeData
import json


class NodeService:
    def __init__(self):
        self.manager = NodeManager()
        self.client = NodeClient()

    def list_nodes(self):
        result = []
        for node in self.manager.status():
            record = dict(node)
            if record["running"]:
                data = self.client.get_status(NodeData(node["name"], node["ip"], int(node["port"])))
                if data and data.get("status"):
                    record["blockchain"] = data["status"]
            result.append(record)
        return result

    def _node_data(self, name):
        from ..motor_blockchain.datos_nodo import NodeData
        node = self.manager.get_node(name)
        if not node:
            raise ValueError("Nodo no encontrado.")
        return NodeData(node["name"], node["ip"], int(node["port"]))

    def get_active_node(self, preferred=None):
        records = self.manager.status()
        if preferred:
            node = next((n for n in records if n["name"] == preferred and n["running"]), None)
            if node:
                return self._node_data(node["name"])
        node = next((n for n in records if n["running"]), None)
        if not node:
            raise ValueError("No hay servidores HealthChain activos.")
        return self._node_data(node["name"])

    def start(self, name, complexity=4, proof_char="0"):
        return self.manager.start_node(name, complexity, proof_char)

    def stop(self, name):
        return self.manager.stop_node(name)

    def create(self, name, ip, port):
        return self.manager.create_node(name, ip, port)

    def delete(self, name):
        return self.manager.delete_node(name)

    def wallet(self, preferred=None):
        return Wallet(self.get_active_node(preferred))

    def genesis(self, preferred=None):
        return self.wallet(preferred).create_genesis()

    def create_record(self, paciente_id, categoria, datos_clinicos, entidad_emisora, preferred=None):
        text = json.dumps(datos_clinicos, ensure_ascii=False, separators=(",", ":"))
        encrypted = Cifrado("clave_" + paciente_id.lower()).encriptar(text)
        if not encrypted:
            return {"success": False, "message": "No fue posible cifrar el registro."}
        return self.wallet(preferred).create_record(paciente_id, categoria, encrypted, entidad_emisora)

    def status(self, preferred=None):
        return self.wallet(preferred).status()

    def blocks(self, preferred=None):
        response = self.wallet(preferred).blocks()
        return response or {"success": False, "blocks": []}

    def history(self, patient_id, preferred=None):
        response = self.wallet(preferred).history(patient_id)
        return response or {"success": False, "history": []}
