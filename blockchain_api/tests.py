import socket
import time
from threading import Event, RLock
from unittest.mock import Mock, patch

from django.conf import settings
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from .motor_blockchain.bloque import Bloque
from .motor_blockchain.cadena_bloques import BlockChain
from .motor_blockchain.cifrado import Cifrado
from .motor_blockchain.datos_nodo import NodeData
from .nodes.client import NodeClient
from .nodes.consensus import ConsensusManager
from .nodes.node_manager import NodeManager
from .nodes.server import BlockchainServer
from .nodes.wallet import Wallet
from .repositories.block_repository import BlockRepository
from .services.node_service import NodeService
from .views import PacientesView


class NodeClientTimeoutTests(SimpleTestCase):
    def test_default_timeout_covers_proof_of_work_requests(self):
        self.assertEqual(NodeClient().timeout, 60)

    def test_wallet_uses_long_timeout_for_blockchain_operations(self):
        wallet = Wallet(NodeData("MEXICO", "127.0.0.1", 5001))
        self.assertEqual(wallet.client.timeout, 60)


class NodeManagerPortTests(SimpleTestCase):
    def make_occupied_port(self):
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        listener.bind(("0.0.0.0", 0))
        listener.listen(1)
        return listener, listener.getsockname()[1]

    def test_create_node_rejects_occupied_port_before_persisting(self):
        manager = NodeManager.__new__(NodeManager)
        manager._read = Mock(return_value=[])
        manager._write = Mock()
        listener, port = self.make_occupied_port()

        try:
            with self.assertRaisesRegex(RuntimeError, "^El puerto está ocupado$"):
                manager.create_node("MEXICO", "127.0.0.1", port)
        finally:
            listener.close()

        manager._write.assert_not_called()

    @patch("blockchain_api.nodes.node_manager.subprocess.Popen")
    def test_start_node_rejects_occupied_port_before_launching(self, popen):
        manager = NodeManager.__new__(NodeManager)
        node = {
            "name": "MEXICO",
            "ip": "127.0.0.1",
            "port": None,
        }
        listener, port = self.make_occupied_port()
        node["port"] = port
        manager.get_node = Mock(return_value=node)
        manager.is_running = Mock(return_value=False)

        try:
            with self.assertRaisesRegex(RuntimeError, "^El puerto está ocupado$"):
                manager.start_node("MEXICO")
        finally:
            listener.close()

        popen.assert_not_called()


class BlockchainIntegrityTests(SimpleTestCase):
    def make_chain(self):
        chain = BlockChain(1, "0")
        chain.create_genesis()
        chain.create_block()
        chain.get_last_block().set_registro_clinico(
            "Hospital", "P001", "CONSULTA", "datos-cifrados"
        )
        chain.mine_block()
        return chain

    def test_chain_serialization_preserves_proof_and_links(self):
        original = self.make_chain()
        restored = BlockChain(1, "0")
        for data in original.to_dict()["chain"]:
            self.assertTrue(
                restored.add_proved_block(BlockRepository._block_from_dict(data))
            )
        self.assertEqual(restored.to_dict(), original.to_dict())
        self.assertEqual(restored.is_chain_valid(), (True, "La cadena es válida."))

    def test_consensus_rejects_a_valid_pow_with_wrong_previous_hash(self):
        chain = BlockChain(1, "0")
        chain.create_genesis()
        invalid_genesis = Bloque(0, "f" * 64)
        chain.block_chain = [invalid_genesis]
        chain.mine_block()
        chain.block_chain = []
        self.assertFalse(ConsensusManager(chain).validate_block(invalid_genesis))

    @patch("blockchain_api.nodes.server.NodeManager")
    def test_node_sync_replaces_a_shorter_chain_with_a_valid_peer_chain(
        self, manager_class
    ):
        remote = self.make_chain()
        local = BlockChain(1, "0")
        self.assertTrue(
            local.add_proved_block(
                BlockRepository._block_from_dict(remote.get_block(0).to_dict())
            )
        )
        peer = NodeData("PEER", "127.0.0.1", 5002)
        manager_class.return_value.get_nodes.return_value = [peer]

        server = BlockchainServer.__new__(BlockchainServer)
        server.current_node = NodeData("LOCAL", "127.0.0.1", 5001)
        server.complexity = 1
        server.proof_char = "0"
        server.blockchain = local
        server.repository = Mock()
        server.repository.replace_chain.return_value = remote
        server.node_client = Mock()
        server.node_client.sync.return_value = {
            "success": True,
            "complexity": 1,
            "proof_of_work": "0",
            "valid": True,
            "blocks": [block.to_dict() for block in remote.get_block_chain()],
        }
        server.lock = RLock()
        server.consensus = ConsensusManager(local)

        server._sync_from_peers()

        self.assertEqual(server.blockchain.size(), remote.size())
        self.assertEqual(server.blockchain.to_dict(), remote.to_dict())
        server.repository.replace_chain.assert_called_once()
        response = server._dispatch({"type": "GET_BLOCKS"})
        self.assertEqual(response["last_hash"], remote.get_last_block().get_hash())
        self.assertEqual(response["blocks"], remote.to_dict()["chain"])
        self.assertGreaterEqual(server.node_client.sync.call_count, 2)

    @patch("blockchain_api.nodes.server.NodeManager")
    def test_isolated_node_can_create_and_persist_genesis(self, manager_class):
        manager_class.return_value.get_nodes.return_value = []
        server = BlockchainServer.__new__(BlockchainServer)
        server.current_node = NodeData("MEXICO", "127.0.0.1", 5001)
        server.complexity = 1
        server.proof_char = "0"
        server.repository = Mock()
        server.blockchain = BlockChain(1, "0")
        server.lock = RLock()
        server.consensus = ConsensusManager(server.blockchain)
        server.node_client = Mock()

        self.assertTrue(server.create_genesis())
        self.assertEqual(server.blockchain.size(), 1)
        server.repository.save_block.assert_called_once()

    @patch("blockchain_api.nodes.server.NodeManager")
    def test_mined_blocks_are_broadcast_between_independent_tcp_nodes(
        self, manager_class
    ):
        probes = [socket.socket(), socket.socket()]
        try:
            for probe in probes:
                probe.bind(("127.0.0.1", 0))
            ports = [probe.getsockname()[1] for probe in probes]
        finally:
            for probe in probes:
                probe.close()
        first_node = NodeData("TCP_TEST_1", "127.0.0.1", ports[0])
        second_node = NodeData("TCP_TEST_2", "127.0.0.1", ports[1])
        manager_class.return_value.get_nodes.return_value = [first_node, second_node]

        def make_server(node):
            server = BlockchainServer.__new__(BlockchainServer)
            server.current_node = node
            server.complexity = 1
            server.proof_char = "0"
            server.repository = Mock()
            server.blockchain = BlockChain(1, "0")
            server.other_servers = []
            server.server_socket = None
            server.running = False
            server.node_client = NodeClient()
            server.lock = RLock()
            server._stop_event = Event()
            server.consensus = ConsensusManager(server.blockchain)
            server.network_cipher = Cifrado(
                getattr(settings, "HEALTHCHAIN_SOCKET_KEY", "MESSI_HEALTHCHAIN_SOCKET")
            )
            return server

        first = make_server(first_node)
        second = make_server(second_node)
        try:
            first.start_server()
            second.start_server()
            self.assertTrue(first.create_genesis())
            result = first._create_record_response(
                {
                    "entidad_emisora": "Hospital",
                    "paciente_id": "P001",
                    "categoria": "CONSULTA",
                    "datos_cifrados": "datos-cifrados",
                }
            )
            self.assertTrue(result["success"])
            deadline = time.monotonic() + 3
            while second.blockchain.size() < 2 and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertEqual(first.blockchain.to_dict(), second.blockchain.to_dict())
            self.assertTrue(second.blockchain.is_chain_valid()[0])
        finally:
            first.stop_server()
            second.stop_server()


class NodeStartupTests(SimpleTestCase):
    @patch("blockchain_api.services.node_service.NodeClient")
    @patch("blockchain_api.services.node_service.NodeManager")
    def test_start_succeeds_with_empty_network(self, manager_class, client_class):
        manager = manager_class.return_value
        manager.status.return_value = [
            {"name": "MEXICO", "running": False},
        ]
        manager.get_node.return_value = {
            "name": "MEXICO",
            "ip": "127.0.0.1",
            "port": 5001,
        }
        client = client_class.return_value
        client.get_blocks.return_value = {
            "success": True,
            "blocks": [],
            "valid": True,
        }
        client.get_status.return_value = {
            "success": True,
            "status": {"node": "MEXICO", "blocks": 0, "initialized": False},
        }

        status = NodeService().start("MEXICO")

        self.assertEqual(status["node"], "MEXICO")
        self.assertEqual(status["blocks"], 0)
        manager.start_node.assert_called_once_with("MEXICO", 4, "0")


class PatientRegistrationTests(SimpleTestCase):
    def test_successful_registration_is_saved_and_duplicate_dui_is_rejected(self):
        factory = APIRequestFactory()
        view = PacientesView.as_view()
        storage = {"pacientes.json": []}
        write = Mock(side_effect=lambda name, data: storage.__setitem__(name, data))
        payload = {
            "nombre": "Paciente de prueba",
            "dui": "12345678-9",
            "fecha_nacimiento": "2000-01-01",
            "tipo_sangre": "O+",
            "alergias": "Ninguna",
            "vacunas": "Completas",
            "cronicas": "Ninguna",
            "tipo": "JVPM",
            "registro": "JVPM-12345",
        }

        with (
            patch(
                "blockchain_api.views._professional_valid",
                return_value={"nombre": "Profesional", "tipo": "JVPM"},
            ),
            patch(
                "blockchain_api.views.read",
                side_effect=lambda name, default=None: storage.get(name, default),
            ),
            patch("blockchain_api.views.write", write),
        ):
            first = view(factory.post("/api/pacientes/", payload, format="json"))
            duplicate = view(
                factory.post(
                    "/api/pacientes/",
                    {**payload, "dui": "12345678-9"},
                    format="json",
                )
            )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(len(storage["pacientes.json"]), 1)
        write.assert_called_once()
