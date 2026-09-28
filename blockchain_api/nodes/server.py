import json
import socket
import struct
import threading

from django.conf import settings

from ..motor_blockchain.bloque import Bloque
from ..motor_blockchain.cadena_bloques import BlockChain
from ..motor_blockchain.cifrado import Cifrado
from ..motor_blockchain.registro_clinico import RegistroClinico
from ..repositories.block_repository import BlockRepository
from .client import NodeClient
from .consensus import ConsensusManager
from .node_manager import NodeManager


class BlockchainServer:
    """Servidor TCP real equivalente a frmServer."""

    def __init__(self, node_data, complexity=4, proof_char="0"):
        self.current_node = node_data
        self.complexity = int(complexity)
        self.proof_char = proof_char
        self.repository = BlockRepository(node_data.get_node_name())
        self.blockchain = self.repository.load_blockchain(self.complexity, self.proof_char)
        self.other_servers = []
        self.server_socket = None
        self.running = False
        self.node_client = NodeClient()
        self.lock = threading.RLock()
        self.consensus = ConsensusManager(self.blockchain)
        self.network_cipher = Cifrado(getattr(settings, "HEALTHCHAIN_SOCKET_KEY", "MESSI_HEALTHCHAIN_SOCKET"))

    def register_net(self, nodes):
        self.other_servers = [n for n in nodes if n.get_node_name() != self.current_node.get_node_name()]

    def start_server(self):
        if self.running:
            return
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.current_node.get_ip_address(), self.current_node.get_socket_num()))
        self.server_socket.listen(20)
        self.running = True
        threading.Thread(target=self._listen, daemon=True).start()
        threading.Thread(target=self._sync_from_peers, daemon=True).start()

    def _listen(self):
        while self.running:
            try:
                connection, address = self.server_socket.accept()
                threading.Thread(target=self._handle_connection, args=(connection, address), daemon=True).start()
            except OSError:
                break

    def _handle_connection(self, connection, address):
        try:
            message = self._receive_message(connection)
            response = self._dispatch(message)
            self._send_response(connection, response)
        except Exception as error:
            self._send_response(connection, {"success": False, "message": str(error)})
        finally:
            connection.close()

    def _receive_message(self, connection):
        header = self._recv_exact(connection, 4)
        if not header:
            raise ValueError("Mensaje vacío.")
        length = struct.unpack("!I", header)[0]
        if length <= 0 or length > 10_000_000:
            raise ValueError("Tamaño de mensaje inválido.")
        raw = self._recv_exact(connection, length)
        decrypted = self.network_cipher.desencriptar(raw.decode("utf-8"))
        if not decrypted:
            raise ValueError("No fue posible descifrar la solicitud.")
        return json.loads(decrypted)

    def _send_response(self, connection, response):
        encrypted = self.network_cipher.encriptar(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
        raw = encrypted.encode("utf-8")
        connection.sendall(struct.pack("!I", len(raw)) + raw)

    @staticmethod
    def _recv_exact(connection, size):
        chunks = []
        remaining = size
        while remaining:
            chunk = connection.recv(min(4096, remaining))
            if not chunk:
                raise ConnectionError("Conexión cerrada antes de completar el mensaje.")
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def _dispatch(self, message):
        message_type = message.get("type")
        if message_type == "PING":
            return {"success": True, "type": "PONG", "node": self.current_node.get_node_name()}
        if message_type == "STATUS":
            return {"success": True, "status": self.status()}
        if message_type == "GET_BLOCKS":
            return {"success": True, "blocks": [b.to_dict() for b in self.blockchain.get_block_chain()]}
        if message_type == "GET_HISTORY":
            return {"success": True, "history": self.get_patient_history(message.get("patient_id", ""))}
        if message_type == "CREATE_GENESIS":
            created = self.create_genesis()
            return {"success": True, "created": created, "message": "Genesis creado." if created else "La Blockchain ya está inicializada.", "status": self.status()}
        if message_type == "CREATE_RECORD":
            return self._create_record_response(message)
        if message_type == "BLOCK":
            accepted = self._process_received_block(self._block_from_dict(message.get("block")))
            return {"success": accepted, "message": "Bloque aceptado." if accepted else "Bloque rechazado."}
        raise ValueError("Tipo de mensaje no soportado.")

    def _create_record_response(self, message):
        with self.lock:
            if self.blockchain.size() == 0:
                self._create_genesis_locked()
            self.blockchain.create_block()
            block = self.blockchain.get_last_block()
            block.set_registro_clinico(
                message.get("entidad_emisora", ""),
                message.get("paciente_id", ""),
                message.get("categoria", ""),
                message.get("datos_cifrados", ""),
            )
            self.blockchain.mine_block()
            self.repository.save_block(block)
            block_data = block.to_dict()
        propagation = self.broadcast_block(self._block_from_dict(block_data))
        return {"success": True, "message": "Registro minado correctamente.", "block": block_data, "propagation": propagation, "status": self.status()}

    def create_genesis(self):
        with self.lock:
            return self._create_genesis_locked()

    def _create_genesis_locked(self):
        if self.blockchain.size() > 0:
            return False
        if not self.blockchain.create_genesis():
            return False
        self.repository.save_block(self.blockchain.get_last_block())
        return True

    def _process_received_block(self, block):
        with self.lock:
            if not self.consensus.validate_block(block):
                return False
            accepted = self.consensus.accept_block(block)
            if accepted:
                self.repository.save_block(block)
            return accepted

    def broadcast_block(self, block):
        results = []
        for node in self.other_servers:
            response = self.node_client.send_block(node, block)
            results.append({"node": node.get_node_name(), "success": bool(response and response.get("success"))})
        return results

    def get_patient_history(self, patient_id):
        result = []
        for block in self.blockchain.get_block_chain():
            for record in block.a_registros:
                if record.get_paciente_id() == patient_id:
                    data = {}
                    try:
                        key = "clave_" + patient_id.lower()
                        text = Cifrado(key).desencriptar(record.get_datos_cifrados())
                        if text:
                            data = json.loads(text)
                    except Exception:
                        data = {}
                    result.append({"id": record.get_id(), "timestamp": record.get_time_stamp(), "entidad_emisora": record.get_entidad_emisora(), "paciente_id": record.get_paciente_id(), "categoria": record.get_categoria(), "datos": data, "block_id": block.get_id(), "block_hash": block.get_hash()})
        return result

    def status(self):
        valid, message = self.blockchain.is_chain_valid()
        return {"node": self.current_node.get_node_name(), "ip": self.current_node.get_ip_address(), "port": self.current_node.get_socket_num(), "running": self.running, "blocks": self.blockchain.size(), "complexity": self.complexity, "proof_of_work": self.blockchain.proof_of_work, "valid": valid, "validation_message": message, "genesis": self.blockchain.get_last_block().to_dict() if self.blockchain.size() else None}

    def _sync_from_peers(self):
        if self.blockchain.size() > 0:
            return
        for node in self.other_servers:
            response = self.node_client.sync(node)
            if not response or not response.get("success"):
                continue
            blocks = response.get("blocks", [])
            with self.lock:
                for block_data in blocks:
                    block = self._block_from_dict(block_data)
                    if self.consensus.validate_block(block):
                        self.consensus.accept_block(block)
                        self.repository.save_block(block)
            if self.blockchain.size() > 0:
                break

    @staticmethod
    def _block_from_dict(data):
        if not isinstance(data, dict):
            raise ValueError("Bloque inválido.")
        block = Bloque(data.get("id", -1), data.get("previous_hash"))
        block.time_stamp = data.get("time_stamp", block.time_stamp)
        block.nonce = data.get("nonce", -1)
        block.hash = data.get("hash")
        for item in data.get("a_registros", []):
            record = RegistroClinico(item.get("id", 0), item.get("entidad_emisora", ""), item.get("paciente_id", ""), item.get("categoria", ""), item.get("datos_cifrados", ""))
            record.time_stamp = item.get("time_stamp", record.time_stamp)
            block.a_registros.append(record)
        return block

    def stop_server(self):
        self.running = False
        if self.server_socket:
            try:
                self.server_socket.close()
            except OSError:
                pass
            self.server_socket = None
