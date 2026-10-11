import json
from pathlib import Path

from ..motor_blockchain.bloque import Bloque
from ..motor_blockchain.cadena_bloques import GENESIS_PREVIOUS_HASH, BlockChain
from ..motor_blockchain.cifrado import Cifrado
from ..motor_blockchain.registro_clinico import RegistroClinico


class BlockRepository:
    """Persistencia cifrada por nodo. Cada bloque usa su hash como nombre."""

    def __init__(self, node_name="NODO_1"):
        self.base_dir = Path(__file__).resolve().parents[2]
        self.node_name = node_name
        self.blocks_dir = self.base_dir / "data" / "nodes" / node_name / "blocks"
        self.blocks_dir.mkdir(parents=True, exist_ok=True)
        self.cipher_key = "MESSI_HEALTHCHAIN_BLOCK_STORAGE"

    def _get_path(self, block_hash):
        return self.blocks_dir / f"{block_hash}.json"

    def save_block(self, block):
        if not block.get_hash():
            raise ValueError("No se puede persistir un bloque sin hash.")
        encrypted = Cifrado(self.cipher_key).encriptar(
            json.dumps(block.to_dict(), ensure_ascii=False, separators=(",", ":"))
        )
        if not encrypted:
            raise ValueError("No fue posible cifrar el bloque.")
        document = {
            "hash": block.get_hash(),
            "node": self.node_name,
            "encrypted": True,
            "algorithm": "AES",
            "data": encrypted,
        }
        with self._get_path(block.get_hash()).open("w", encoding="utf-8") as file:
            json.dump(document, file, ensure_ascii=False, indent=2)
        return str(self._get_path(block.get_hash()))

    def get_block(self, block_hash):
        path = self._get_path(block_hash)
        if not path.exists():
            return None
        try:
            with path.open("r", encoding="utf-8") as file:
                document = json.load(file)
            decrypted = Cifrado(self.cipher_key).desencriptar(document["data"])
            return json.loads(decrypted) if decrypted else None
        except (OSError, json.JSONDecodeError, KeyError, TypeError):
            return None

    def list_blocks(self):
        result = []
        for path in self.blocks_dir.glob("*.json"):
            data = self.get_block(path.stem)
            if data:
                result.append(data)
        return sorted(result, key=lambda item: item.get("id", -1))

    def exists(self, block_hash):
        return self._get_path(block_hash).exists()

    def load_blockchain(self, complexity=4, proof_char="0"):
        blockchain = BlockChain(complexity, proof_char)
        paths_by_tip = {}
        for data in self.list_blocks():
            try:
                block = self._block_from_dict(data)
            except (AttributeError, KeyError, TypeError, ValueError):
                continue
            if (
                not blockchain.get_proof_of_work_over_block(block)
                or block.get_hash()[:complexity] != blockchain.proof_of_work
            ):
                continue
            if block.get_id() == 0:
                if block.get_previous_hash() != GENESIS_PREVIOUS_HASH:
                    continue
                candidate = [block]
            else:
                parent = paths_by_tip.get(block.get_previous_hash())
                if not parent or block.get_id() != len(parent):
                    continue
                candidate = [*parent, block]
            paths_by_tip[block.get_hash()] = candidate

        if paths_by_tip:
            selected = min(
                paths_by_tip.values(),
                key=lambda path: (-len(path), path[-1].get_hash()),
            )
            blockchain.block_chain = selected
        return blockchain

    def replace_chain(self, blocks, complexity=4, proof_char="0"):
        blockchain = BlockChain(complexity, proof_char)
        for block in blocks:
            restored = self._block_from_dict(block)
            if not blockchain.add_proved_block(restored):
                raise ValueError("La cadena recibida contiene un bloque inválido.")
        if not blockchain.is_chain_valid()[0]:
            raise ValueError("La cadena recibida no supera la validación de integridad.")
        for restored in blockchain.get_block_chain():
            self.save_block(restored)
        return blockchain

    @staticmethod
    def _block_from_dict(data):
        if not isinstance(data, dict) or not isinstance(data.get("a_registros", []), list):
            raise ValueError("Bloque inválido.")
        block_id = data.get("id", -1)
        timestamp = data.get("time_stamp")
        nonce = data.get("nonce", -1)
        block_hash = data.get("hash")
        previous_hash = data.get("previous_hash")
        if (
            not isinstance(block_id, int)
            or isinstance(block_id, bool)
            or not isinstance(timestamp, int)
            or isinstance(timestamp, bool)
            or not isinstance(nonce, int)
            or isinstance(nonce, bool)
            or not isinstance(block_hash, str)
            or not isinstance(previous_hash, str)
        ):
            raise ValueError("Los metadatos del bloque son inválidos.")
        block = Bloque(block_id, previous_hash)
        block.time_stamp = timestamp
        block.nonce = nonce
        block.hash = block_hash
        for item in data.get("a_registros", []):
            if not isinstance(item, dict):
                raise ValueError("El bloque contiene un registro inválido.")
            record_id = item.get("id", 0)
            record_timestamp = item.get("time_stamp")
            values = [
                item.get("entidad_emisora", ""),
                item.get("paciente_id", ""),
                item.get("categoria", ""),
                item.get("datos_cifrados", ""),
            ]
            if (
                not isinstance(record_id, int)
                or isinstance(record_id, bool)
                or not isinstance(record_timestamp, int)
                or isinstance(record_timestamp, bool)
                or not all(isinstance(value, str) for value in values)
            ):
                raise ValueError("Los datos del registro clínico son inválidos.")
            record = RegistroClinico(
                record_id,
                values[0],
                values[1],
                values[2],
                values[3],
            )
            record.time_stamp = record_timestamp
            block.a_registros.append(record)
        return block
