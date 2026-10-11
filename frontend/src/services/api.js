
function readLocalJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.detail ||
        `Error HTTP ${response.status}`,
    );
  }

  return data;
}

// ==========================================
// VALIDACIÓN DE PROFESIONALES
// ==========================================

export async function validateProfessional(tipo, registro) {
  return request("/validar-profesional/", {
    method: "POST",
    body: JSON.stringify({ tipo, registro }),
  });
}

// ==========================================
// PACIENTES
// ==========================================

export async function getPatients() {
  const response = await request("/pacientes/");
  const patients = response.pacientes || [];

  localStorage.setItem(
    "healthchain_patients_cache",
    JSON.stringify(patients),
  );

  localStorage.setItem(
    "healthchain_patients",
    JSON.stringify(patients),
  );

  return response;
}

export async function createPatient(data, credential) {
  if (!credential?.tipo || !credential?.registro) {
    throw new Error(
      "Debes validar tus credenciales profesionales.",
    );
  }

  const response = await request("/pacientes/", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      tipo: credential.tipo,
      registro: credential.registro,
    }),
  });

  if (!response.success || !response.paciente) {
    throw new Error(
      response.message ||
        "El servidor no confirmó el registro del paciente.",
    );
  }

  const current = readLocalJson(
    "healthchain_patients_cache",
    [],
  );

  const patient = response.paciente;

  const next = [
    ...current.filter((item) => item.id !== patient.id),
    patient,
  ];

  localStorage.setItem(
    "healthchain_patients_cache",
    JSON.stringify(next),
  );

  localStorage.setItem(
    "healthchain_patients",
    JSON.stringify(next),
  );

  return response;
}

// ==========================================
// HISTORIAL CLÍNICO
// ==========================================

export async function getPatientHistory(id, node, credential) {
  if (!credential?.tipo || !credential?.registro) {
    throw new Error(
      "Debes validar tus credenciales profesionales.",
    );
  }

  const params = new URLSearchParams();

  if (node) params.set("node", node);

  params.set("tipo", credential.tipo);
  params.set("registro", credential.registro);

  return request(
    `/pacientes/${encodeURIComponent(id)}/historial/?${params.toString()}`,
  );
}

// ==========================================
// REGISTROS CLÍNICOS
// ==========================================

export async function createClinicalRecord(data, credential) {
  if (!credential?.tipo || !credential?.registro) {
    throw new Error(
      "Debes validar tus credenciales profesionales.",
    );
  }

  const response = await request("/registros/", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      tipo: credential.tipo,
      registro: credential.registro,
    }),
  });

  if (!response.success || !response.block?.hash) {
    throw new Error(
      response.message ||
        "El nodo no confirmó la creación del bloque.",
    );
  }

  return response;
}

// ==========================================
// BLOCKCHAIN
// ==========================================

export async function getBlockchainStatus(node) {
  const query = node
    ? `?node=${encodeURIComponent(node)}`
    : "";

  const response = await request(`/blockchain/status/${query}`);

  if (!response.success) {
    throw new Error(
      response.message ||
        "No se pudo consultar el estado del nodo.",
    );
  }

  return response;
}

export async function getBlockchainBlocks(node) {
  const query = node
    ? `?node=${encodeURIComponent(node)}`
    : "";

  const response = await request(`/blockchain/blocks/${query}`);

  if (!response.success || !Array.isArray(response.blocks)) {
    throw new Error(
      response.message ||
        "El nodo no devolvió una cadena de bloques válida.",
    );
  }

  return response;
}

export async function createGenesis(complexity, proofChar, node) {
  const response = await request("/blockchain/genesis/", {
    method: "POST",
    body: JSON.stringify({
      complexity,
      proof_char: proofChar,
      node,
    }),
  });

  if (!response.success) {
    throw new Error(
      response.message || "No se pudo crear el bloque Genesis.",
    );
  }

  return response;
}

// ==========================================
// NODOS / SERVIDORES
// ==========================================

export async function getNodes() {
  const response = await request("/nodes/");
  const nodes = response.nodes || [];

  localStorage.setItem(
    "healthchain_nodes_cache",
    JSON.stringify(nodes),
  );

  localStorage.setItem(
    "healthchain_nodes",
    JSON.stringify(nodes),
  );

  const active = nodes.find((node) => node.running);
  const selected = localStorage.getItem(
    "healthchain_selected_node",
  );

  if (
    selected &&
    nodes.some(
      (node) => node.name === selected && node.running,
    )
  ) {
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
  const response = await request("/nodes/", {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.success || !response.node) {
    throw new Error(
      response.message || "No se pudo crear el nodo.",
    );
  }

  const current = readLocalJson(
    "healthchain_nodes_cache",
    [],
  );

  const node = response.node;

  const next = [
    ...current.filter((item) => item.name !== node.name),
    {
      ...node,
      running: false,
      status: "DETENIDO",
    },
  ];

  localStorage.setItem(
    "healthchain_nodes_cache",
    JSON.stringify(next),
  );

  localStorage.setItem(
    "healthchain_nodes",
    JSON.stringify(next),
  );

  return response;
}

export async function startNode(
  name,
  complexity = 4,
  proofChar = "0",
) {
  const response = await request(
    `/nodes/${encodeURIComponent(name)}/start/`,
    {
      method: "POST",
      body: JSON.stringify({
        complexity,
        proof_char: proofChar,
      }),
    },
  );

  if (!response.success || !response.node?.running) {
    throw new Error(
      response.message ||
        `El nodo ${name} no confirmó el inicio y la sincronización.`,
    );
  }

  localStorage.setItem("healthchain_selected_node", name);
  localStorage.setItem("healthchain_active_node", name);

  return response;
}

export async function stopNode(name) {
  return request(
    `/nodes/${encodeURIComponent(name)}/stop/`,
    {
      method: "POST",
    },
  );
}

export async function deleteNode(name) {
  return request(
    `/nodes/${encodeURIComponent(name)}/`,
    {
      method: "DELETE",
    },
  );
}
