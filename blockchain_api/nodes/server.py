import json
import logging
import socket
import struct
import threading
import time

from django.conf import settings

from ..motor_blockchain.cadena_bloques import BlockChain
from ..motor_blockchain.cifrado import Cifrado
from ..repositories.block_repository import BlockRepository
from .client import NodeClient
from .consensus import ConsensusManager
from .node_manager import NodeManager

logger = logging.getLogger(__name__)


class BlockchainServer:
    """Servidor TCP real equivalente a frmServer."""

    def __init__(self, node_data, complexity=4, proof_char="0"):
        self.current_node = node_data
        self.complexity = int(complexity)
        self.proof_char = str(proof_char)

        self.repository = BlockRepository(node_data.get_node_name())

        self.blockchain = self.repository.load_blockchain(
            self.complexity,
            self.proof_char,
        )

        self.other_servers = []
        self.server_socket = None
        self.running = False

        self.node_client = NodeClient()
        self.lock = threading.RLock()

        self.consensus = ConsensusManager(self.blockchain)

        self.network_cipher = Cifrado(
            getattr(
                settings,
                "HEALTHCHAIN_SOCKET_KEY",
                "MESSI_HEALTHCHAIN_SOCKET",
            )
        )

    def register_net(self, nodes):
        self.other_servers = [
            node
            for node in nodes
            if node.get_node_name() != self.current_node.get_node_name()
        ]

    def start_server(self):
        if self.running:
            return

        self.server_socket = socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM,
        )

        self.server_socket.setsockopt(
            socket.SOL_SOCKET,
            socket.SO_REUSEADDR,
            1,
        )

        self.server_socket.bind(
            (
                self.current_node.get_ip_address(),
                self.current_node.get_socket_num(),
            )
        )

        self.server_socket.listen(20)
        self.running = True

        threading.Thread(
            target=self._listen,
            daemon=True,
        ).start()

        threading.Thread(
            target=self._sync_loop,
            daemon=True,
        ).start()

        # Intentar sincronizar al iniciar el nodo.
        # Si los otros nodos todavía no están disponibles,
        # el ciclo periódico volverá a intentarlo.
        threading.Thread(
            target=self._initial_sync,
            daemon=True,
        ).start()

    def _initial_sync(self):
        time.sleep(0.3)

        try:
            self._sync_from_peers()
        except Exception:
            logger.exception(
                "Error en la sincronización inicial del nodo %s.",
                self.current_node.get_node_name(),
            )

    def _listen(self):
        while self.running:
            try:
                connection, address = self.server_socket.accept()

                threading.Thread(
                    target=self._handle_connection,
                    args=(connection, address),
                    daemon=True,
                ).start()

            except OSError:
                break

    def _handle_connection(self, connection, address):
        try:
            message = self._receive_message(connection)
            response = self._dispatch(message)
            self._send_response(connection, response)

        except Exception as error:
            logger.exception(
                "Error atendiendo solicitud TCP desde %s.",
                address,
            )

            try:
                self._send_response(
                    connection,
                    {
                        "success": False,
                        "message": str(error),
                    },
                )
            except Exception:
                pass

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
        encrypted = self.network_cipher.encriptar(
            json.dumps(
                response,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )

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
            return {
                "success": True,
                "type": "PONG",
                "node": self.current_node.get_node_name(),
            }

        if message_type == "STATUS":
            self._sync_from_peers()

            with self.lock:
                return {
                    "success": True,
                    "status": self.status(),
                }

        if message_type == "GET_BLOCKS":
            self._sync_from_peers()

            with self.lock:
                return self._chain_response()

        # Devuelve la copia local sin iniciar otra sincronización.
        # Esto evita llamadas recursivas entre nodos.
        if message_type == "SYNC_CHAIN":
            with self.lock:
                return self._chain_response()

        if message_type == "GET_HISTORY":
            self._sync_from_peers()

            with self.lock:
                return {
                    "success": True,
                    "history": self.get_patient_history(message.get("patient_id", "")),
                }

        if message_type == "CREATE_GENESIS":
            created = self.create_genesis()

            return {
                "success": True,
                "created": created,
                "message": (
                    "Genesis creado."
                    if created
                    else "La Blockchain ya está inicializada."
                ),
                "status": self.status(),
            }

        if message_type == "CREATE_RECORD":
            return self._create_record_response(message)

        if message_type == "BLOCK":
            block_data = message.get("block")

            if not isinstance(block_data, dict):
                return {
                    "success": False,
                    "message": "Los datos del bloque no son válidos.",
                }

            block = self._block_from_dict(block_data)
            accepted = self._process_received_block(block)

            return {
                "success": accepted,
                "message": (
                    "Bloque aceptado."
                    if accepted
                    else "Bloque rechazado o ya existente."
                ),
            }

        raise ValueError("Tipo de mensaje no soportado.")

    def _chain_response(self):
        with self.lock:
            valid, validation_message = self.blockchain.is_chain_valid()

            blocks = [block.to_dict() for block in self.blockchain.get_block_chain()]

            return {
                "success": True,
                "blocks": blocks,
                "complexity": self.complexity,
                "proof_of_work": self.blockchain.proof_of_work,
                "valid": valid,
                "validation_message": validation_message,
                "last_hash": (blocks[-1]["hash"] if blocks else None),
            }

    def _create_record_response(self, message):
        # Recuperar primero cualquier cadena válida que falte.
        self._sync_from_peers()

        with self.lock:
            if self.blockchain.size() == 0:
                return {
                    "success": False,
                    "message": (
                        "Este nodo no tiene una Blockchain inicializada. "
                        "Se intentó sincronizar con los demás nodos, "
                        "pero no se encontró una cadena válida. "
                        "Comprueba que exista un nodo activo con Genesis."
                    ),
                }

            valid, validation_message = self.blockchain.is_chain_valid()

            if not valid:
                return {
                    "success": False,
                    "message": (
                        "No se puede registrar la atención porque la "
                        f"Blockchain no es válida: {validation_message}"
                    ),
                }

            self.blockchain.create_block()
            block = self.blockchain.get_last_block()

            block.set_registro_clinico(
                message.get("entidad_emisora", ""),
                message.get("paciente_id", ""),
                message.get("categoria", ""),
                message.get("datos_cifrados", ""),
            )

            self.blockchain.mine_block()
            block_data = block.to_dict()

            try:
                self.repository.save_block(block)
            except Exception:
                self.blockchain.block_chain.pop()
                raise

            # Actualizar el administrador de consenso con la cadena actual.
            self.consensus = ConsensusManager(self.blockchain)

        propagation = self.broadcast_block(self._block_from_dict(block_data))

        return {
            "success": True,
            "message": "Registro minado correctamente.",
            "block": block_data,
            "propagation": propagation,
            "status": self.status(),
        }

    def create_genesis(self):
        # Antes de crear Genesis, comprobar si otro nodo ya tiene cadena.
        self._sync_from_peers()

        with self.lock:
            if self.blockchain.size() > 0:
                return False

            created = self._create_genesis_locked()

            block_data = self.blockchain.get_last_block().to_dict() if created else None

        if created:
            propagation = self.broadcast_block(self._block_from_dict(block_data))

            logger.info(
                "Genesis creado en %s. Propagación: %s",
                self.current_node.get_node_name(),
                propagation,
            )

        return created

    def _create_genesis_locked(self):
        if self.blockchain.size() > 0:
            return False

        if not self.blockchain.create_genesis():
            return False

        try:
            self.repository.save_block(self.blockchain.get_last_block())

        except Exception:
            self.blockchain.block_chain.pop()
            raise

        return True

    def _process_received_block(self, block):
        with self.lock:
            # Si ya existe el bloque, no guardarlo otra vez.
            if self.blockchain.block_exist(block):
                return any(
                    existing.get_id() == block.get_id()
                    and existing.get_hash() == block.get_hash()
                    for existing in self.blockchain.get_block_chain()
                )

            # Un bloque que no continúa la cadena local puede indicar
            # que el nodo está atrasado. Se intentará sincronizar después.
            if not self.consensus.validate_block(block):
                logger.warning(
                    "Bloque recibido fuera de secuencia en %s. "
                    "Se solicitará sincronización.",
                    self.current_node.get_node_name(),
                )

                threading.Thread(
                    target=self._sync_from_peers,
                    daemon=True,
                ).start()

                return False

            # Actualizar memoria y almacenamiento de forma consistente.
            if not self.blockchain.add_proved_block(block):
                return False

            try:
                self.repository.save_block(block)

            except Exception:
                self.blockchain.block_chain.pop()
                self.consensus = ConsensusManager(self.blockchain)
                raise

            self.consensus = ConsensusManager(self.blockchain)

            logger.info(
                "Bloque %s aceptado por %s.",
                block.get_id(),
                self.current_node.get_node_name(),
            )

            return True

    def broadcast_block(self, block):
        # Consultar la lista actual para incluir nodos creados después.
        peers = [
            node
            for node in NodeManager().get_nodes()
            if node.get_node_name() != self.current_node.get_node_name()
        ]

        results = []

        for node in peers:
            response = self.node_client.send_block(node, block)

            results.append(
                {
                    "node": node.get_node_name(),
                    "success": bool(response and response.get("success")),
                }
            )

        return results

    def get_patient_history(self, patient_id):
        result = []

        for block in self.blockchain.get_block_chain():
            for record in block.a_registros:
                if record.get_paciente_id() != patient_id:
                    continue

                key = "clave_" + patient_id.lower()

                text = Cifrado(key).desencriptar(record.get_datos_cifrados())

                if not text:
                    raise ValueError(
                        f"No fue posible descifrar el registro "
                        f"del bloque {block.get_id()}."
                    )

                data = json.loads(text)

                if not isinstance(data, dict):
                    raise ValueError(
                        f"Los datos clínicos del bloque "
                        f"{block.get_id()} no tienen un formato válido."
                    )

                result.append(
                    {
                        "id": record.get_id(),
                        "timestamp": record.get_time_stamp(),
                        "entidad_emisora": record.get_entidad_emisora(),
                        "paciente_id": record.get_paciente_id(),
                        "categoria": record.get_categoria(),
                        "datos": data,
                        "block_id": block.get_id(),
                        "block_hash": block.get_hash(),
                    }
                )

        return result

    def status(self):
        with self.lock:
            valid, message = self.blockchain.is_chain_valid()

            last_block = (
                self.blockchain.get_last_block() if self.blockchain.size() else None
            )

            return {
                "node": self.current_node.get_node_name(),
                "ip": self.current_node.get_ip_address(),
                "port": self.current_node.get_socket_num(),
                "running": self.running,
                "initialized": last_block is not None,
                "blocks": self.blockchain.size(),
                "complexity": self.complexity,
                "proof_of_work": self.blockchain.proof_of_work,
                "valid": valid,
                "validation_message": message,
                "last_hash": (last_block.get_hash() if last_block else None),
                "genesis": (last_block.to_dict() if last_block else None),
            }

    def _sync_from_peers(self):
        """
        Busca cadenas válidas de los demás nodos y recupera la cadena
        más larga cuando el nodo local está vacío o atrasado.

        No mina de nuevo los bloques: conserva sus hashes originales.
        """

        peers = [
            node
            for node in NodeManager().get_nodes()
            if node.get_node_name() != self.current_node.get_node_name()
        ]

        candidates = []

        for node in peers:
            response = self.node_client.sync(node)

            if not response or not response.get("success"):
                continue

            if response.get("valid") is not True:
                continue

            if (
                response.get("complexity") != self.complexity
                or response.get("proof_of_work") != self.blockchain.proof_of_work
            ):
                logger.warning(
                    "Se ignora la cadena de %s por diferencias "
                    "en la configuración de Proof of Work.",
                    node.get_node_name(),
                )
                continue

            blocks = response.get("blocks")

            if not isinstance(blocks, list) or not blocks:
                continue

            candidate = BlockChain(
                self.complexity,
                self.proof_char,
            )

            try:
                for block_data in blocks:
                    if not isinstance(block_data, dict):
                        raise ValueError("Formato de bloque remoto inválido.")

                    block = self._block_from_dict(block_data)

                    if not candidate.add_proved_block(block):
                        raise ValueError(
                            "La cadena remota contiene un bloque "
                            "duplicado o inválido."
                        )

                valid, validation_message = candidate.is_chain_valid()

                if not valid:
                    raise ValueError(validation_message)

            except (
                AttributeError,
                KeyError,
                TypeError,
                ValueError,
            ) as error:
                logger.warning(
                    "Cadena inválida recibida desde %s: %s",
                    node.get_node_name(),
                    error,
                )
                continue

            candidates.append(
                (
                    node.get_node_name(),
                    candidate,
                )
            )

        if not candidates:
            return

        # Elegir la cadena válida más larga. Si varias tienen la misma
        # longitud, preferir una cadena que ya coincida con la local.
        peer_name, best_chain = max(
            candidates,
            key=lambda item: (
                item[1].size(),
                item[1].get_last_block().get_hash(),
            ),
        )

        remote_blocks = best_chain.get_block_chain()

        with self.lock:
            local_blocks = self.blockchain.get_block_chain()
            local_size = len(local_blocks)
            remote_size = len(remote_blocks)

            local_valid, _ = self.blockchain.is_chain_valid()

            local_hashes = [block.get_hash() for block in local_blocks]

            remote_hashes = [block.get_hash() for block in remote_blocks]

            # Un nodo vacío debe adoptar la cadena remota.
            # Un nodo atrasado debe recuperar los bloques que le faltan.
            # Una cadena local inválida puede sustituirse por una válida.
            should_replace = (
                remote_size > local_size
                or not local_valid
                or (local_size == 0 and remote_size > 0)
            )

            # Si tienen la misma longitud, no reemplazar una cadena válida
            # solo porque tenga un hash distinto. Podría ser una bifurcación.
            if (
                local_valid
                and local_size == remote_size
                and local_size > 0
                and local_hashes == remote_hashes
            ):
                should_replace = False

            if not should_replace:
                return

            serialized_chain = [block.to_dict() for block in remote_blocks]

            # replace_chain debe persistir la cadena completa y devolver
            # el objeto BlockChain cargado con esos mismos bloques.
            updated_chain = self.repository.replace_chain(
                serialized_chain,
                self.complexity,
                self.proof_char,
            )

            updated_valid, updated_message = updated_chain.is_chain_valid()

            if not updated_valid:
                raise RuntimeError(
                    "El repositorio devolvió una cadena inválida: " f"{updated_message}"
                )

            self.blockchain = updated_chain
            self.consensus = ConsensusManager(self.blockchain)

            logger.info(
                "Nodo %s sincronizado desde %s: %s bloques.",
                self.current_node.get_node_name(),
                peer_name,
                self.blockchain.size(),
            )

    def _sync_loop(self):
        while self.running:
            try:
                self._sync_from_peers()

            except Exception:
                logger.exception(
                    "Error sincronizando el nodo %s con la red.",
                    self.current_node.get_node_name(),
                )

            time.sleep(2)

    @staticmethod
    def _block_from_dict(data):
        return BlockRepository._block_from_dict(data)

    def stop_server(self):
        self.running = False

        if self.server_socket:
            try:
                self.server_socket.close()

            except OSError:
                pass

            self.server_socket = None
