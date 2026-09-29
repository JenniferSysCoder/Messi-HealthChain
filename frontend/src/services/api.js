function readLocalJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.detail || `Error HTTP ${response.status}`);
  return data;
}

export async function validateProfessional(tipo, registro) {
  return request("/validar-profesional/", {
    method: "POST",
    body: JSON.stringify({ tipo, registro }),
  });
}

export async function getPatients() {
  const response = await request("/pacientes/");
  const patients = response.pacientes || [];
  localStorage.setItem("healthchain_patients_cache", JSON.stringify(patients));
  localStorage.setItem("healthchain_patients", JSON.stringify(patients));
  return response;
}

export async function createPatient(data, credential) {
  const response = await request("/pacientes/", {
    method: "POST",
    body: JSON.stringify({ ...data, tipo: credential.tipo, registro: credential.registro }),
  });
  const current = readLocalJson("healthchain_patients_cache", []);
  const patient = response.paciente;
  if (patient) {
    const next = [...current.filter((item) => item.id !== patient.id), patient];
    localStorage.setItem("healthchain_patients_cache", JSON.stringify(next));
    localStorage.setItem("healthchain_patients", JSON.stringify(next));
  }
  return response;
}

export async function getPatientHistory(id, node, credential) {
  const params = new URLSearchParams();
  if (node) params.set("node", node);
  if (credential?.tipo) params.set("tipo", credential.tipo);
  if (credential?.registro) params.set("registro", credential.registro);
  return request(`/pacientes/${encodeURIComponent(id)}/historial/?${params.toString()}`);
}

export async function createClinicalRecord(data, credential) {
  return request("/registros/", {
    method: "POST",
    body: JSON.stringify({ ...data, tipo: credential?.tipo, registro: credential?.registro }),
  });
}

export async function getBlockchainStatus(node) { return request(`/blockchain/status/${node ? `?node=${encodeURIComponent(node)}` : ""}`); }
export async function getBlockchainBlocks(node) { return request(`/blockchain/blocks/${node ? `?node=${encodeURIComponent(node)}` : ""}`); }
export async function createGenesis(complexity, proofChar, node) { return request("/blockchain/genesis/", { method: "POST", body: JSON.stringify({ complexity, proof_char: proofChar, node }) }); }

export async function getNodes() {
  const response = await request("/nodes/");
  const nodes = response.nodes || [];
  localStorage.setItem("healthchain_nodes_cache", JSON.stringify(nodes));
  localStorage.setItem("healthchain_nodes", JSON.stringify(nodes));
  const active = nodes.find((node) => node.running);
  const selected = localStorage.getItem("healthchain_selected_node");
  if (selected && nodes.some((node) => node.name === selected && node.running)) {
    localStorage.setItem("healthchain_active_node", selected);
  } else if (active) {
    localStorage.setItem("healthchain_selected_node", active.name);
    localStorage.setItem("healthchain_active_node", active.name);
  } else localStorage.removeItem("healthchain_active_node");
  return response;
}

export async function createNode(data) {
  const response = await request("/nodes/", { method: "POST", body: JSON.stringify(data) });
  const current = readLocalJson("healthchain_nodes_cache", []);
  const node = response.node;
  if (node) {
    const next = [...current.filter((item) => item.name !== node.name), { ...node, running: false, status: "DETENIDO" }];
    localStorage.setItem("healthchain_nodes_cache", JSON.stringify(next));
    localStorage.setItem("healthchain_nodes", JSON.stringify(next));
  }
  return response;
}
export async function startNode(name, complexity=4, proofChar="0") {
  const response = await request(`/nodes/${encodeURIComponent(name)}/start/`, { method: "POST", body: JSON.stringify({ complexity, proof_char: proofChar }) });
  localStorage.setItem("healthchain_selected_node", name);
  localStorage.setItem("healthchain_active_node", name);
  return response;
}
export async function stopNode(name) { return request(`/nodes/${encodeURIComponent(name)}/stop/`, { method: "POST" }); }
export async function deleteNode(name) { return request(`/nodes/${encodeURIComponent(name)}/`, { method: "DELETE" }); }
