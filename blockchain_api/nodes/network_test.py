import time

from ..motor_blockchain.datos_nodo import NodeData
from .node_manager import NodeManager
from .server import BlockchainServer


def main():

    node_manager = NodeManager()

    node1 = NodeData("NODO_1", "127.0.0.1", 5001)

    node2 = NodeData("NODO_2", "127.0.0.1", 5002)

    node_manager.register_node(node1)
    node_manager.register_node(node2)

    server1 = BlockchainServer(node1, complexity=2, proof_char="0")

    server2 = BlockchainServer(node2, complexity=2, proof_char="0")

    server1.register_net(node_manager.get_nodes())

    server2.register_net(node_manager.get_nodes())

    server1.create_genesis()

    server2.blockchain.block_chain = server1.blockchain.block_chain.copy()

    server1.start_server()
    server2.start_server()

    print()
    print("==========================================")
    print("      HEALTHCHAIN - RED DE NODOS")
    print("==========================================")
    print()
    print("NODO 1")
    print("IP:     127.0.0.1")
    print("PUERTO: 5001")
    print()
    print("NODO 2")
    print("IP:     127.0.0.1")
    print("PUERTO: 5002")
    print()
    print("==========================================")
    print("Servidores activos.")
    print("==========================================")
    print()

    time.sleep(2)

    print("[PRUEBA] Creando bloque clínico en NODO_1...")
    print()

    block = server1.create_and_mine_block(
        entidad="HealthChain",
        paciente="PACIENTE-001",
        categoria="Consulta general",
        datos_cifrados="DATOS_CLINICOS_CIFRADOS",
    )

    print()
    print("==========================================")
    print("           BLOQUE GENERADO")
    print("==========================================")
    print(f"ID:             {block.get_id()}")
    print(f"Hash:           {block.get_hash()}")
    print(f"Previous Hash:  {block.get_previous_hash()}")
    print(f"Nonce:          {block.get_nonce()}")
    print("==========================================")
    print()

    time.sleep(2)

    print("==========================================")
    print("           ESTADO DE LA RED")
    print("==========================================")
    print(f"NODO_1 - Bloques: " f"{server1.blockchain.size()}")
    print(f"NODO_2 - Bloques: " f"{server2.blockchain.size()}")
    print("==========================================")

    try:
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        print()
        print("Deteniendo nodos...")
        server1.stop_server()
        server2.stop_server()


if __name__ == "__main__":
    main()
