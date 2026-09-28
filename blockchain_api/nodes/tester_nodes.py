import time

from ..motor_blockchain.datos_nodo import NodeData
from .node_manager import NodeManager
from .server import BlockchainServer


def main():

    manager = NodeManager()

    node1 = NodeData("NODO_1", "127.0.0.1", 5001)

    node2 = NodeData("NODO_2", "127.0.0.1", 5002)

    manager.register_node(node1)
    manager.register_node(node2)

    server1 = BlockchainServer(node1, complexity=2, proof_char="0")

    server2 = BlockchainServer(node2, complexity=2, proof_char="0")

    server1.register_net(manager.get_nodes())

    server2.register_net(manager.get_nodes())

    server1.create_genesis()

    server2.blockchain.block_chain = server1.blockchain.block_chain.copy()

    server2.repository.save_block(server2.blockchain.get_last_block())

    server1.start_server()
    server2.start_server()

    print()
    print("==========================================")
    print("       MESSI HEALTHCHAIN - NETWORK")
    print("==========================================")
    print()
    print("NODO 1 → 127.0.0.1:5001")
    print("NODO 2 → 127.0.0.1:5002")
    print()
    print("TCP/IP + Proof of Work + Consenso")
    print("==========================================")
    print()

    time.sleep(2)

    print("[1] Creando bloque clínico...")

    block = server1.create_and_mine_block(
        entidad="Hospital HealthChain",
        paciente="P001",
        categoria="CONSULTA",
        datos_cifrados="DATOS_CLINICOS_CIFRADOS",
    )

    print()
    print("[2] BLOQUE:")
    print(f"ID: {block.get_id()}")
    print(f"Previous Hash: " f"{block.get_previous_hash()}")
    print(f"Nonce: {block.get_nonce()}")
    print(f"Hash: {block.get_hash()}")

    time.sleep(2)

    print()
    print("==========================================")
    print("              RESULTADO")
    print("==========================================")

    print(f"NODO 1: " f"{server1.blockchain.size()} bloques")

    print(f"NODO 2: " f"{server2.blockchain.size()} bloques")

    valid1 = server1.blockchain.is_chain_valid()

    valid2 = server2.blockchain.is_chain_valid()

    print()
    print(f"NODO 1 VALIDACIÓN: {valid1}")

    print(f"NODO 2 VALIDACIÓN: {valid2}")

    print("==========================================")

    try:

        while True:
            time.sleep(1)

    except KeyboardInterrupt:

        server1.stop_server()
        server2.stop_server()


if __name__ == "__main__":
    main()
