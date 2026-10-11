import json
import time

from ..motor_blockchain.cifrado import Cifrado
from ..motor_blockchain.datos_nodo import NodeData
from ..nodes.client import NodeClient
from ..nodes.node_manager import NodeManager
from ..nodes.wallet import Wallet


class NodeService:
    def __init__(self):
        self.manager = NodeManager()
        self.client = NodeClient()

    def list_nodes(self):
        result = []

        for node in self.manager.status():
            record = dict(node)

            if record["running"]:
                data = self.client.get_status(
                    NodeData(
                        node["name"],
                        node["ip"],
                        int(node["port"]),
                    )
                )

                if data and data.get("success") and data.get("status"):
                    record["blockchain"] = data["status"]

            result.append(record)

        return result

    def _node_data(self, name):
        node = self.manager.get_node(name)

        if not node:
            raise ValueError("Nodo no encontrado.")

        return NodeData(
            node["name"],
            node["ip"],
            int(node["port"]),
        )

    def get_active_node(self, preferred=None):
        records = self.manager.status()

        if preferred:
            node = next(
                (item for item in records if item["name"] == preferred),
                None,
            )

            if not node:
                raise ValueError("Nodo no encontrado.")

            if not node["running"]:
                raise RuntimeError(f"El nodo {preferred} no está activo.")

            return self._node_data(node["name"])

        node = next(
            (item for item in records if item["running"]),
            None,
        )

        if not node:
            raise ValueError("No hay servidores HealthChain activos.")

        return self._node_data(node["name"])

    def _get_active_peer_chains(self, excluded_name):
        """Obtiene las cadenas válidas de los demás nodos activos."""
        candidates = []

        for peer in self.manager.status():
            if peer["name"] == excluded_name or not peer["running"]:
                continue

            node_data = NodeData(
                peer["name"],
                peer["ip"],
                int(peer["port"]),
            )

            response = self.client.get_blocks(node_data)

            if not response or not response.get("success"):
                continue

            blocks = response.get("blocks")

            if (
                not isinstance(blocks, list)
                or response.get("valid") is not True
                or not blocks
            ):
                continue

            candidates.append(
                {
                    "name": peer["name"],
                    "complexity": response.get("complexity"),
                    "proof_of_work": response.get("proof_of_work"),
                    "blocks": blocks,
                }
            )

        return candidates

    def start(self, name, complexity=4, proof_char="0"):
        complexity = int(complexity)
        proof_char = str(proof_char)

        if complexity < 1 or complexity > 6:
            raise ValueError("La complejidad debe estar entre 1 y 6.")

        if not proof_char:
            raise ValueError("El carácter de prueba de trabajo es obligatorio.")

        # Leer las cadenas de los nodos activos antes de iniciar el nuevo.
        peer_chains = self._get_active_peer_chains(name)

        if peer_chains:
            configurations = {
                (
                    item["complexity"],
                    item["proof_of_work"],
                )
                for item in peer_chains
            }

            if len(configurations) != 1:
                raise RuntimeError(
                    "Los nodos activos tienen configuraciones de "
                    "Proof of Work diferentes. Corrige la configuración "
                    "antes de incorporar otro nodo."
                )

            network_complexity, network_proof = next(iter(configurations))

            if not isinstance(network_complexity, int):
                raise RuntimeError("La complejidad de la red no es válida.")

            if network_proof != proof_char * network_complexity:
                proof_char = network_proof[0]

            complexity = network_complexity

        # Iniciar el proceso TCP del nodo.
        self.manager.start_node(name, complexity, proof_char)

        node = self._node_data(name)

        # Consultar repetidamente. GET_BLOCKS hace que el servidor
        # intente sincronizarse con los demás nodos activos.
        deadline = time.monotonic() + 12
        last_response = None

        while time.monotonic() < deadline:
            last_response = self.client.get_blocks(node)

            if last_response and last_response.get("success"):
                blocks = last_response.get("blocks", [])

                if not isinstance(blocks, list):
                    raise RuntimeError(f"El nodo {name} devolvió una cadena inválida.")

                if blocks and last_response.get("valid") is not True:
                    raise RuntimeError(f"El nodo {name} tiene una cadena inválida.")

                # Si los demás nodos ya tienen bloques, el nuevo
                # debe terminar con una cadena de al menos ese tamaño.
                peer_chains = self._get_active_peer_chains(name)

                if peer_chains:
                    longest_peer = max(
                        peer_chains,
                        key=lambda item: len(item["blocks"]),
                    )

                    expected_blocks = longest_peer["blocks"]
                    expected_last_hash = expected_blocks[-1].get("hash")

                    same_configuration = (
                        last_response.get("complexity") == longest_peer["complexity"]
                        and last_response.get("proof_of_work")
                        == longest_peer["proof_of_work"]
                    )

                    synchronized = (
                        same_configuration
                        and len(blocks) >= len(expected_blocks)
                        and blocks[len(expected_blocks) - 1].get("hash")
                        == expected_last_hash
                    )

                    if synchronized:
                        status_response = self.client.get_status(node)

                        if (
                            status_response
                            and status_response.get("success")
                            and status_response.get("status")
                        ):
                            return status_response["status"]

                elif blocks or not peer_chains:
                    # No se exige Genesis si toda la red está vacía.
                    # Si hay bloques, la cadena local ya fue validada.
                    status_response = self.client.get_status(node)

                    if (
                        status_response
                        and status_response.get("success")
                        and status_response.get("status")
                    ):
                        return status_response["status"]

            time.sleep(0.4)

        # No fingir que hubo sincronización.
        final_response = self.client.get_blocks(node)

        if final_response and final_response.get("success"):
            if final_response.get("blocks"):
                raise RuntimeError(
                    f"El nodo {name} inició, pero no se pudo confirmar "
                    "que tenga la misma cadena que los demás nodos."
                )

            if peer_chains:
                raise RuntimeError(
                    f"El nodo {name} continúa vacío aunque existen "
                    "otros nodos con bloques. Revisa la sincronización "
                    "TCP y los registros en data/node_logs."
                )

        raise RuntimeError(
            f"No fue posible verificar el estado de {name}. "
            "Revisa su registro en data/node_logs."
        )

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

    def create_record(
        self,
        paciente_id,
        categoria,
        datos_clinicos,
        entidad_emisora,
        preferred=None,
    ):
        text = json.dumps(
            datos_clinicos,
            ensure_ascii=False,
            separators=(",", ":"),
        )

        encrypted = Cifrado("clave_" + paciente_id.lower()).encriptar(text)

        if not encrypted:
            return {
                "success": False,
                "message": "No fue posible cifrar el registro.",
            }

        response = self.wallet(preferred).create_record(
            paciente_id,
            categoria,
            encrypted,
            entidad_emisora,
        )

        if not response:
            raise RuntimeError(
                "No se recibió respuesta del nodo al registrar la atención."
            )

        return response

    def status(self, preferred=None):
        response = self.wallet(preferred).status()

        if not response or not response.get("success") or not response.get("status"):
            raise RuntimeError("No se pudo consultar el estado del nodo seleccionado.")

        return response["status"]

    def blocks(self, preferred=None):
        response = self.wallet(preferred).blocks()

        if (
            not response
            or not response.get("success")
            or not isinstance(response.get("blocks"), list)
        ):
            raise RuntimeError(
                "No se pudieron consultar los bloques del nodo seleccionado."
            )

        return response

    def history(self, patient_id, preferred=None):
        response = self.wallet(preferred).history(patient_id)

        if (
            not response
            or not response.get("success")
            or not isinstance(response.get("history"), list)
        ):
            raise RuntimeError(
                "No se pudo consultar el historial del nodo seleccionado."
            )

        return response
