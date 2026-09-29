import json
from pathlib import Path

from ..motor_blockchain.bloque import Bloque
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
        from ..motor_blockchain.cadena_bloques import BlockChain

        existing = self.list_blocks()

        blockchain = BlockChain(complexity, proof_char)
        blockchain.block_chain = []
        for data in existing:
            block = Bloque(data.get("id", -1), data.get("previous_hash"))
            block.time_stamp = data.get("time_stamp", block.time_stamp)
            block.nonce = data.get("nonce", -1)
            block.hash = data.get("hash")
            for item in data.get("a_registros", []):
                record = RegistroClinico(
                    item.get("id", 0),
                    item.get("entidad_emisora", ""),
                    item.get("paciente_id", ""),
                    item.get("categoria", ""),
                    item.get("datos_cifrados", ""),
                )
                record.time_stamp = item.get("time_stamp", record.time_stamp)
                block.a_registros.append(record)
            blockchain.block_chain.append(block)
            if not self.exists(block.get_hash()):
                try:
                    self.save_block(block)
                except ValueError:
                    pass
        return blockchain

    def replace_chain(self, blocks, complexity=4, proof_char="0"):
        from ..motor_blockchain.cadena_bloques import BlockChain

        blockchain = BlockChain(complexity, proof_char)
        blockchain.block_chain = []
        for block in blocks:
            restored = self._block_from_dict(block)
            if blockchain.size() == 0:
                if restored.get_id() != 0:
                    continue
            else:
                if restored.get_id() != blockchain.get_last_block().get_id() + 1:
                    continue
                if restored.get_previous_hash() != blockchain.get_last_block().get_hash():
                    continue
            if not blockchain.get_proof_of_work_over_block(restored):
                continue
            blockchain.block_chain.append(restored)
            self.save_block(restored)
        return blockchain

    @staticmethod
    def _block_from_dict(data):
        block = Bloque(data.get("id", -1), data.get("previous_hash"))
        block.time_stamp = data.get("time_stamp", block.time_stamp)
        block.nonce = data.get("nonce", -1)
        block.hash = data.get("hash")
        for item in data.get("a_registros", []):
            record = RegistroClinico(
                item.get("id", 0),
                item.get("entidad_emisora", ""),
                item.get("paciente_id", ""),
                item.get("categoria", ""),
                item.get("datos_cifrados", ""),
            )
            record.time_stamp = item.get("time_stamp", record.time_stamp)
            block.a_registros.append(record)
        return block
