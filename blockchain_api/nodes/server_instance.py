import sys
import time

import django

from ..motor_blockchain.datos_nodo import NodeData
from .node_manager import NodeManager
from .server import BlockchainServer


def main():
    if len(sys.argv) not in (4, 6):
        raise SystemExit("Uso: python -m blockchain_api.nodes.server_instance NOMBRE IP PUERTO [COMPLEJIDAD PROOF]")
    django.setup()
    name, ip, port = sys.argv[1], sys.argv[2], int(sys.argv[3])
    complexity = int(sys.argv[4]) if len(sys.argv) == 6 else 4
    proof = sys.argv[5] if len(sys.argv) == 6 else "0"
    node = NodeData(name, ip, port)
    manager = NodeManager()
    manager.register_node(node)
    server = BlockchainServer(node, complexity, proof)
    server.register_net(manager.get_nodes())
    server.start_server()
    try:
        while server.running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        server.stop_server()


if __name__ == "__main__":
    import os
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    main()
