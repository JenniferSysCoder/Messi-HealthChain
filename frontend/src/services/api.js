function readLocalJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }
  catch { return fallback; }
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request(endpoint, options = {}) {
  const token = localStorage.getItem("healthchain_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.detail || `Error HTTP ${response.status}`);
  return data;
}

export async function login(username, password) {
  const response = await request("/login/", { method: "POST", body: JSON.stringify({ username, password }) });
  localStorage.setItem("healthchain_token", response.token);
  localStorage.setItem("healthchain_user", JSON.stringify(response.usuario));
  return response;
}
export function logout() { localStorage.removeItem("healthchain_token"); localStorage.removeItem("healthchain_user"); localStorage.removeItem("healthchain_session_active"); }
export async function getProfile() { return request("/perfil/"); }
export async function getPatients() {
  const response = await request("/pacientes/");
  const patients = response.pacientes || [];
  localStorage.setItem("healthchain_patients_cache", JSON.stringify(patients));
  localStorage.setItem("healthchain_patients", JSON.stringify(patients));
  return response;
}
export async function createPatient(data) {
  const response = await request("/pacientes/", { method: "POST", body: JSON.stringify(data) });
  const current = readLocalJson("healthchain_patients_cache", []);
  const patient = response.paciente;
  if (patient) {
    const next = [...current.filter((item) => item.id !== patient.id), patient];
    localStorage.setItem("healthchain_patients_cache", JSON.stringify(next));
    localStorage.setItem("healthchain_patients", JSON.stringify(next));
  }
  return response;
}

export async function getPatientHistory(id, node) { return request(`/pacientes/${encodeURIComponent(id)}/historial/${node ? `?node=${encodeURIComponent(node)}` : ""}`); }
export async function createClinicalRecord(data) { return request("/registros/", { method: "POST", body: JSON.stringify(data) }); }
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
  } else {
    localStorage.removeItem("healthchain_active_node");
  }
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
  const current = readLocalJson("healthchain_nodes", []);
  const updated = current.map((node) => node.name === name ? { ...node, ...(response.node || {}), running: true, status: "ACTIVO" } : node);
  localStorage.setItem("healthchain_nodes", JSON.stringify(updated));
  localStorage.setItem("healthchain_nodes_cache", JSON.stringify(updated));
  return response;
}
export async function stopNode(name) {
  const response = await request(`/nodes/${encodeURIComponent(name)}/stop/`, { method: "POST" });
  const current = readLocalJson("healthchain_nodes", []);
  const updated = current.map((node) => node.name === name ? { ...node, ...(response.node || {}), running: false, status: "DETENIDO" } : node);
  localStorage.setItem("healthchain_nodes", JSON.stringify(updated));
  localStorage.setItem("healthchain_nodes_cache", JSON.stringify(updated));
  if (localStorage.getItem("healthchain_active_node") === name) localStorage.removeItem("healthchain_active_node");
  return response;
}
export async function deleteNode(name) {
  const response = await request(`/nodes/${encodeURIComponent(name)}/`, { method: "DELETE" });
  const current = readLocalJson("healthchain_nodes_cache", []);
  const next = current.filter((item) => item.name !== name);
  localStorage.setItem("healthchain_nodes_cache", JSON.stringify(next));
  localStorage.setItem("healthchain_nodes", JSON.stringify(next));
  if (localStorage.getItem("healthchain_selected_node") === name) localStorage.removeItem("healthchain_selected_node");
  if (localStorage.getItem("healthchain_active_node") === name) localStorage.removeItem("healthchain_active_node");
  return response;
}
