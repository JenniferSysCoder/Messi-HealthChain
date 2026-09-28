import json
import socket
import struct

from django.conf import settings

from ..motor_blockchain.cifrado import Cifrado


class NodeClient:
    """Wallet/cliente TCP de HealthChain con mensajes cifrados y framing."""

    def __init__(self, timeout=8):
        self.timeout = timeout
        self.cipher = Cifrado(getattr(settings, "HEALTHCHAIN_SOCKET_KEY", "MESSI_HEALTHCHAIN_SOCKET"))

    def _send_message(self, node, message):
        payload = json.dumps(message, ensure_ascii=False, separators=(",", ":"))
        encrypted = self.cipher.encriptar(payload)
        if not encrypted:
            raise OSError("No fue posible cifrar el mensaje TCP.")
        raw = encrypted.encode("utf-8")
        packet = struct.pack("!I", len(raw)) + raw
        with socket.create_connection((node.get_ip_address(), node.get_socket_num()), self.timeout) as client:
            client.settimeout(self.timeout)
            client.sendall(packet)
            header = self._recv_exact(client, 4)
            if not header:
                return None
            length = struct.unpack("!I", header)[0]
            response_raw = self._recv_exact(client, length)
            if not response_raw:
                return None
            decrypted = self.cipher.desencriptar(response_raw.decode("utf-8"))
            return json.loads(decrypted) if decrypted else None

    @staticmethod
    def _recv_exact(client, size):
        chunks = []
        remaining = size
        while remaining:
            chunk = client.recv(min(4096, remaining))
            if not chunk:
                return b""
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks)

    def request(self, node, message):
        try:
            return self._send_message(node, message)
        except (OSError, ValueError, json.JSONDecodeError, TypeError):
            return None

    def ping(self, node):
        return self.request(node, {"type": "PING"})

    def get_status(self, node):
        return self.request(node, {"type": "STATUS"})

    def get_blocks(self, node):
        return self.request(node, {"type": "GET_BLOCKS"})

    def get_history(self, node, patient_id):
        return self.request(node, {"type": "GET_HISTORY", "patient_id": patient_id})

    def create_genesis(self, node):
        return self.request(node, {"type": "CREATE_GENESIS"})

    def create_record(self, node, paciente_id, categoria, datos_cifrados, entidad_emisora):
        return self.request(
            node,
            {
                "type": "CREATE_RECORD",
                "paciente_id": paciente_id,
                "categoria": categoria,
                "datos_cifrados": datos_cifrados,
                "entidad_emisora": entidad_emisora,
            },
        )

    def send_block(self, node, block):
        return self.request(node, {"type": "BLOCK", "block": block.to_dict()})

    def sync(self, node):
        return self.request(node, {"type": "GET_BLOCKS"})
