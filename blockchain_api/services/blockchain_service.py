from ..nodes.node_manager import NodeManager
from .node_service import NodeService


def blockchain_exists():
    return any(item.get("running") and (item.get("blockchain") or {}).get("blocks", 0) > 0 for item in NodeService().list_nodes())


def create_genesis(complexity, proof_char, node_name=None):
    service = NodeService()
    try:
        result = service.genesis(node_name)
        if result:
            if result.get("success") and result.get("message") == "La Blockchain ya está inicializada.":
                result["created"] = False
            elif result.get("success"):
                result["created"] = True
            return result
        return {"success": False, "message": "El servidor no respondió."}
    except Exception as error:
        return {"success": False, "message": str(error)}


def get_blockchain_status(node_name=None):
    try:
        response = NodeService().status(node_name)
        return response.get("status", response) if response else {"initialized": False, "valid": False, "blocks": 0, "message": "Sin respuesta del servidor."}
    except Exception as error:
        return {"initialized": False, "valid": False, "blocks": 0, "message": str(error)}


def get_blocks(node_name=None):
    try:
        return NodeService().blocks(node_name).get("blocks", [])
    except Exception:
        return []


def get_patient_history(paciente_id, node_name=None):
    try:
        return NodeService().history(paciente_id, node_name).get("history", [])
    except Exception:
        return []


def create_clinical_record(paciente_id, categoria, datos_clinicos, entidad_emisora, node_name=None):
    try:
        return NodeService().create_record(paciente_id, categoria, datos_clinicos, entidad_emisora, node_name)
    except Exception as error:
        return {"success": False, "message": str(error)}
