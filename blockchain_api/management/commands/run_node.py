from django.core.management.base import BaseCommand, CommandError

from blockchain_api.motor_blockchain.datos_nodo import NodeData
from blockchain_api.nodes.node_manager import NodeManager
from blockchain_api.nodes.server import BlockchainServer


class Command(BaseCommand):
    help = "Inicia un servidor TCP real de MESSI HealthChain."

    def add_arguments(self, parser):
        parser.add_argument("name")
        parser.add_argument("ip", nargs="?", default="127.0.0.1")
        parser.add_argument("port", type=int)
        parser.add_argument("--complexity", type=int, default=4)
        parser.add_argument("--proof", default="0")

    def handle(self, *args, **options):
        name = options["name"].upper()
        manager = NodeManager()
        node = manager.get_node(name)
        if not node:
            raise CommandError("El nodo no está registrado.")
        data = NodeData(name, options["ip"], options["port"])
        manager.register_node(data)
        server = BlockchainServer(data, options["complexity"], options["proof"])
        server.register_net(manager.get_nodes())
        try:
            server.start_server()
            self.stdout.write(self.style.SUCCESS(f"{name} escuchando en {options['ip']}:{options['port']}"))
            while server.running:
                import time
                time.sleep(1)
        except KeyboardInterrupt:
            self.stdout.write("Deteniendo servidor...")
        finally:
            server.stop_server()
