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
    response = NodeService().status(node_name)
    return response.get("status", response)


def get_blocks(node_name=None):
    return NodeService().blocks(node_name)


def get_patient_history(paciente_id, node_name=None):
    return NodeService().history(paciente_id, node_name).get("history", [])


def create_clinical_record(paciente_id, categoria, datos_clinicos, entidad_emisora, node_name=None):
    return NodeService().create_record(
        paciente_id, categoria, datos_clinicos, entidad_emisora, node_name
    )
