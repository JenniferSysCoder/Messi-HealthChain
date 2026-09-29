import json
import os
import signal
import subprocess
import sys
from pathlib import Path
import socket
import time

from ..motor_blockchain.datos_nodo import NodeData


class NodeManager:
    """Registro persistente y administrador de procesos de nodos TCP."""

    def __init__(self):
        self.base_dir = Path(__file__).resolve().parents[2]
        self.path = self.base_dir / "data" / "nodes.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.logs_dir = self.base_dir / "data" / "node_logs"
        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_default_nodes()

    def _read(self):
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            return data if isinstance(data, list) else []
        except (OSError, json.JSONDecodeError):
            return []

    def _write(self, data):
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)

    def _ensure_default_nodes(self):
        nodes = self._read()
        if not nodes:
            nodes = [
                {"name": "NODO_1", "ip": "127.0.0.1", "port": 5001, "pid": None},
                {"name": "NODO_2", "ip": "127.0.0.1", "port": 5002, "pid": None},
            ]
            self._write(nodes)

    def get_records(self):
        return self._read()

    def get_nodes(self):
        return [NodeData(n["name"], n["ip"], int(n["port"])) for n in self._read()]

    def get_node(self, name):
        for node in self._read():
            if node["name"] == name:
                return node
        return None

    def register_node(self, node_data):
        nodes = self._read()
        existing = self.get_node(node_data.get_node_name())
        if existing:
            existing.update({"ip": node_data.get_ip_address(), "port": node_data.get_socket_num()})
        else:
            nodes.append({"name": node_data.get_node_name(), "ip": node_data.get_ip_address(), "port": node_data.get_socket_num(), "pid": None})
        self._write(nodes)
        return node_data

    def create_node(self, name, ip, port):
        name = str(name).strip().upper()
        ip = str(ip).strip()
        port = int(port)
        if not name or not ip or not 1 <= port <= 65535:
            raise ValueError("Datos de nodo inválidos.")
        nodes = self._read()
        if any(n["name"] == name for n in nodes):
            raise ValueError("Ya existe un nodo con ese nombre.")
        if any(int(n["port"]) == port and n["ip"] == ip for n in nodes):
            raise ValueError("Ya existe un nodo con esa IP y puerto.")
        nodes.append({"name": name, "ip": ip, "port": port, "pid": None})
        self._write(nodes)
        return nodes[-1]

    def delete_node(self, name):
        node = self.get_node(name)
        if not node:
            raise ValueError("Nodo no encontrado.")
        if self.is_running(node):
            self.stop_node(name)
        nodes = [n for n in self._read() if n["name"] != name]
        self._write(nodes)

    def is_running(self, node):
        """Comprueba proceso y socket para evitar estados falsos."""
        pid = node.get("pid")
        if not pid:
            return False
        try:
            os.kill(int(pid), 0)
        except (OSError, ValueError):
            return False
        try:
            with socket.create_connection((node["ip"], int(node["port"])), timeout=0.35):
                return True
        except OSError:
            return False

    def start_node(self, name, complexity=4, proof_char="0"):
        node = self.get_node(name)
        if not node:
            raise ValueError("Nodo no encontrado.")
        if self.is_running(node):
            return self.status(name)

        cmd = [
            sys.executable,
            "-m",
            "blockchain_api.nodes.server_instance",
            node["name"],
            node["ip"],
            str(node["port"]),
            str(int(complexity)),
            str(proof_char),
        ]
        log_path = self.logs_dir / f"{node['name']}.log"
        log_file = log_path.open("a", encoding="utf-8")
        if os.name == "nt":
            creationflags = (
                getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                | getattr(subprocess, "DETACHED_PROCESS", 0)
            )
            process = subprocess.Popen(
                cmd, cwd=str(self.base_dir), stdout=log_file, stderr=subprocess.STDOUT,
                creationflags=creationflags, close_fds=True,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        else:
            process = subprocess.Popen(
                cmd, cwd=str(self.base_dir), stdout=log_file, stderr=subprocess.STDOUT,
                start_new_session=True, close_fds=True,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )
        log_file.close()
        node["pid"] = process.pid
        self._save_pid(name, process.pid)
        # El botón "Iniciar" solo devuelve ACTIVO cuando el socket realmente escucha.
        deadline = time.time() + 4.0
        while time.time() < deadline:
            if self.is_running(node):
                return self.status(name)
            if process.poll() is not None:
                break
            time.sleep(0.08)
        self._save_pid(name, None)
        log_hint = f" Revisa el registro {log_path.name} en data/node_logs."
        raise RuntimeError(f"El servidor no pudo iniciar en {node['ip']}:{node['port']}.{log_hint}")

    def stop_node(self, name):
        node = self.get_node(name)
        if not node:
            raise ValueError("Nodo no encontrado.")
        pid = node.get("pid")
        if pid:
            try:
                os.kill(int(pid), signal.SIGTERM)
            except OSError:
                pass
        self._save_pid(name, None)
        return self.status(name)

    def _save_pid(self, name, pid):
        nodes = self._read()
        for node in nodes:
            if node["name"] == name:
                node["pid"] = pid
        self._write(nodes)

    def status(self, name=None):
        records = self._read()
        result = []
        for node in records:
            running = self.is_running(node)
            if not running and node.get("pid") is not None:
                node["pid"] = None
            result.append({**node, "running": running, "status": "ACTIVO" if running else "DETENIDO"})
        self._write(records)
        if name:
            return next(item for item in result if item["name"] == name)
        return result
