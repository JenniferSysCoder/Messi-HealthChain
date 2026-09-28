import { useEffect, useMemo, useState } from "react";
import {
  createClinicalRecord, createGenesis, createNode, createPatient, deleteNode,
  getBlockchainBlocks, getBlockchainStatus, getNodes, getPatientHistory,
  getPatients, startNode, stopNode,
} from "../services/api";

const roleLabel = {
  ADMIN: "Administrador",
  PROFESIONAL: "Profesional de salud",
  PACIENTE: "Paciente",
};

const emptyPatient = {
  nombre: "", dui: "", fecha_nacimiento: "", tipo_sangre: "",
  alergias: "", vacunas: "", cronicas: "", telefono: "", direccion: "",
};

const emptyRecord = {
  category: "CONSULTA",
  diagnostico: "",
  tratamiento: "",
  observaciones: "",
  signos_vitales: "",
};

export default function DashboardPage({ user, onLogout }) {
  const role = user.rol;
  const nav = useMemo(() => {
    if (role === "ADMIN") return [
      ["inicio", "⌂", "Inicio"],
      ["pacientes", "♙", "Pacientes"],
      ["historial", "◷", "Historial"],
      ["blockchain", "◈", "Blockchain"],
      ["red", "⌁", "Red de nodos"],
    ];
    if (role === "PROFESIONAL") return [
      ["inicio", "⌂", "Inicio"],
      ["pacientes", "♙", "Pacientes"],
      ["historial", "◷", "Historial"],
      ["registro", "＋", "Registrar atención"],
    ];
    return [
      ["inicio", "⌂", "Inicio"],
      ["perfil", "◎", "Mi información"],
      ["historial", "◷", "Mi historial"],
    ];
  }, [role]);

  const [section, setSection] = useState("inicio");
  const [nodes, setNodes] = useState(() => readLocal("healthchain_nodes", []));
  const [selectedNode, setSelectedNode] = useState(() => localStorage.getItem("healthchain_selected_node") || "");
  const [patients, setPatients] = useState(() => readLocal("healthchain_patients", []));
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [chain, setChain] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [genesis, setGenesis] = useState({ complexity: 4, proof: "0" });
  const [nodeForm, setNodeForm] = useState({ name: "", ip: "127.0.0.1", port: "" });
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [record, setRecord] = useState(emptyRecord);

  const activeNodes = useMemo(() => nodes.filter((node) => node.running), [nodes]);

  useEffect(() => {
    if (role === "ADMIN") loadNodes();
    loadPatients();
  }, [role]);

  useEffect(() => {
    if (role === "ADMIN" && section === "blockchain") loadChain();
    if (role === "ADMIN" && section === "red") loadNodes();
  }, [role, section, selectedNode]);

  useEffect(() => {
    if (role === "PACIENTE" && user.paciente_id) {
      const patient = patients.find((item) => item.id === user.paciente_id) || {
        id: user.paciente_id,
        nombre: user.nombre,
      };
      loadHistory(patient);
    }
  }, [role, user.paciente_id, patients]);

  async function loadNodes() {
    try {
      const response = await getNodes();
      const list = response.nodes || [];
      setNodes(list);
      localStorage.setItem("healthchain_nodes", JSON.stringify(list));
      localStorage.setItem("healthchain_nodes_cache", JSON.stringify(list));
      const saved = localStorage.getItem("healthchain_selected_node") || localStorage.getItem("healthchain_active_node");
      const preferred = list.find((item) => item.name === saved && item.running) || list.find((item) => item.running);
      if (preferred) {
        setSelectedNode(preferred.name);
        localStorage.setItem("healthchain_selected_node", preferred.name);
        localStorage.setItem("healthchain_active_node", preferred.name);
      } else if (!list.length) {
        setSelectedNode("");
        localStorage.removeItem("healthchain_active_node");
      }
    } catch (e) {
      setError(e.message);
      setNodes(readLocal("healthchain_nodes", []));
    }
  }

  async function loadPatients() {
    try {
      const response = await getPatients();
      const list = response.pacientes || [];
      setPatients(list);
      localStorage.setItem("healthchain_patients", JSON.stringify(list));
      localStorage.setItem("healthchain_patients_cache", JSON.stringify(list));
    } catch (e) {
      setPatients(readLocal("healthchain_patients", []));
      if (role !== "PACIENTE") setError(e.message);
    }
  }

  async function loadChain() {
    if (!selectedNode) return;
    setLoading(true);
    try {
      const [status, blockResponse] = await Promise.all([
        getBlockchainStatus(selectedNode),
        getBlockchainBlocks(selectedNode),
      ]);
      setChain(status);
      setBlocks(blockResponse.blocks || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(patient) {
    if (!patient?.id) return;
    setSelectedPatient(patient);
    if (role !== "PACIENTE") setSection("historial");
    setMobileMenu(false);
    setLoading(true);
    setError("");
    try {
      const node = role === "ADMIN" ? selectedNode : undefined;
      const response = await getPatientHistory(patient.id, node);
      setSelectedPatient(response.paciente || patient);
      setHistory(response.historial || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function navigate(id) {
    setSection(id);
    setMessage("");
    setError("");
    setMobileMenu(false);
    if (id === "pacientes" || id === "registro") loadPatients();
    if (id === "blockchain") loadChain();
  }

  async function runAction(callback, successMessage) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await callback();
      setMessage(successMessage);
      if (role === "ADMIN") await loadNodes();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function registerPatient(event) {
    event.preventDefault();
    await runAction(async () => {
      const response = await createPatient(patientForm);
      if (!response.success) throw new Error(response.message || "No fue posible registrar el paciente.");
      setPatientForm(emptyPatient);
      setShowPatientForm(false);
      await loadPatients();
    }, "Paciente registrado correctamente. La ficha quedó almacenada en pacientes.json.");
  }

  async function submitRecord(event) {
    event.preventDefault();
    if (!selectedPatient) {
      setError("Selecciona un paciente.");
      return;
    }
    await runAction(async () => {
      const response = await createClinicalRecord({
        paciente_id: selectedPatient.id,
        categoria: record.category,
        datos: {
          diagnostico: record.diagnostico,
          tratamiento: record.tratamiento,
          observaciones: record.observaciones,
          signos_vitales: record.signos_vitales,
        },
      });
      if (!response.success) throw new Error(response.message || "No fue posible crear el registro clínico.");
      setRecord(emptyRecord);
      await loadHistory(selectedPatient);
    }, "Atención clínica minada y registrada en la Blockchain.");
  }

  async function doGenesis(event) {
    event.preventDefault();
    const node = selectedNode || activeNodes[0]?.name;
    if (!node) {
      setError("Primero debes iniciar al menos un servidor TCP.");
      return;
    }
    if (chain?.blocks > 0) {
      setMessage("La Blockchain ya está inicializada en este nodo.");
      return;
    }
    await runAction(async () => {
      const response = await createGenesis(Number(genesis.complexity), genesis.proof, node);
      if (!response.success) throw new Error(response.message || "No fue posible crear Genesis.");
      setSelectedNode(node);
      localStorage.setItem("healthchain_selected_node", node);
      localStorage.setItem("healthchain_active_node", node);
      await loadChain();
    }, "Genesis creado en el servidor y enviado a la red.");
  }

  async function createServer(event) {
    event.preventDefault();
    await runAction(async () => {
      await createNode(nodeForm);
      setNodeForm({ name: "", ip: "127.0.0.1", port: "" });
    }, "Servidor configurado correctamente.");
  }

  const pageTitle = nav.find((item) => item[0] === section)?.[2] || "Inicio";

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-backdrop" aria-label="Cerrar menú" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="brand side">
          <div className="brand-mark">M10<span>+</span></div>
          <div><strong>MESSI<br />HealthChain</strong><small>Historia clínica digital</small></div>
        </div>
        <div className="user-mini">
          <div className="avatar">{user.nombre?.[0] || "U"}</div>
          <div><b>{user.nombre}</b><span>{roleLabel[role]}</span></div>
        </div>
        <div className="nav-label">MENÚ</div>
        <nav>
          {nav.map(([id, icon, label]) => (
            <button key={id} className={section === id ? "nav-link active" : "nav-link"} onClick={() => navigate(id)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={onLogout}>↪ Cerrar sesión</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-title">
            <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú">☰</button>
            <div><span className="eyebrow">MESSI HEALTHCHAIN</span><h1>{pageTitle}</h1></div>
          </div>
          <div className="top-actions">
            {role === "ADMIN" && nodes.length > 0 && (
              <select value={selectedNode} onChange={(event) => selectNode(event.target.value)} aria-label="Nodo seleccionado">
                {nodes.map((node) => <option key={node.name} value={node.name}>{node.name} · {node.running ? "Activo" : "Detenido"}</option>)}
              </select>
            )}
            <div className="role-chip">{roleLabel[role]}</div>
          </div>
        </header>

        {message && <div className="alert success">✓ {message}</div>}
        {error && <div className="alert danger">{error}</div>}

        {section === "inicio" && <Home user={user} role={role} nodes={nodes} active={activeNodes.length} setSection={navigate} />}
        {section === "perfil" && <PatientProfile patient={selectedPatient || patients.find((p) => p.id === user.paciente_id)} />}
        {section === "pacientes" && <Patients patients={patients} role={role} onSelect={loadHistory} onNew={() => setShowPatientForm(true)} />}
        {section === "historial" && <History patient={selectedPatient} history={history} loading={loading} role={role} onBack={() => navigate("pacientes")} />}
        {section === "registro" && <RecordForm patients={patients} selected={selectedPatient} setSelected={setSelectedPatient} record={record} setRecord={setRecord} onSubmit={submitRecord} />}
        {section === "blockchain" && <Blockchain chain={chain} blocks={blocks} loading={loading} genesis={genesis} setGenesis={setGenesis} onGenesis={doGenesis} selectedNode={selectedNode} />}
        {section === "red" && <Network nodes={nodes} form={nodeForm} setForm={setNodeForm} onCreate={createServer} onStart={(name) => runAction(() => startNode(name), `${name} iniciado.`)} onStop={(name) => runAction(() => stopNode(name), `${name} detenido.`)} onDelete={(name) => runAction(() => deleteNode(name), `${name} eliminado.`)} />}
      </main>

      {showPatientForm && role === "PROFESIONAL" && <PatientModal form={patientForm} setForm={setPatientForm} onSubmit={registerPatient} onClose={() => setShowPatientForm(false)} loading={loading} />}
    </div>
  );

  function selectNode(name) {
    setSelectedNode(name);
    localStorage.setItem("healthchain_selected_node", name);
    const node = nodes.find((item) => item.name === name);
    if (node?.running) localStorage.setItem("healthchain_active_node", name);
    else localStorage.removeItem("healthchain_active_node");
  }
}

function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function Home({ user, role, nodes, active, setSection }) {
  if (role === "PACIENTE") return <section className="content">
    <div className="welcome-card patient-welcome"><div><span className="eyebrow">PORTAL DEL PACIENTE</span><h2>{user.nombre}</h2><p>Consulta tu información personal y los registros clínicos que te pertenecen.</p></div><div className="welcome-icon">◎</div></div>
    <div className="quick-grid"><Quick icon="◎" title="Mi información" text="Consulta tus datos registrados." onClick={() => setSection("perfil")} /><Quick icon="◷" title="Mi historial" text="Consulta tus atenciones clínicas." onClick={() => setSection("historial")} /></div>
  </section>;

  if (role === "PROFESIONAL") return <section className="content">
    <div className="welcome-card professional-welcome"><div><span className="eyebrow">ÁREA CLÍNICA</span><h2>{user.nombre}</h2><p>Registra pacientes y documenta atenciones clínicas. Cada atención válida genera un bloque mediante el servidor HealthChain.</p></div><div className="welcome-icon">✚</div></div>
    <div className="quick-grid"><Quick icon="♙" title="Pacientes" text="Registrar y consultar pacientes." onClick={() => setSection("pacientes")} /><Quick icon="＋" title="Registrar atención" text="Crear un evento clínico y minar su bloque." onClick={() => setSection("registro")} /><Quick icon="◷" title="Historial" text="Consultar el historial de un paciente." onClick={() => setSection("historial")} /></div>
  </section>;

  return <section className="content">
    <div className="welcome-card admin-welcome"><div><span className="eyebrow">ADMINISTRACIÓN DE RED</span><h2>{user.nombre}</h2><p>Configura los servidores, inicializa Genesis y supervisa la integridad de la Blockchain.</p></div><div className="welcome-icon">⌘</div></div>
    <div className="stats"><Stat label="Nodos activos" value={active} /><Stat label="Nodos configurados" value={nodes.length} /><Stat label="Blockchain" value="Red" /><Stat label="Protocolo" value="TCP/IP" /></div>
    <div className="quick-grid"><Quick icon="◈" title="Blockchain" text="Genesis, bloques, hashes y Proof of Work." onClick={() => setSection("blockchain")} /><Quick icon="⌁" title="Red de nodos" text="Crear, iniciar y detener servidores TCP." onClick={() => setSection("red")} /><Quick icon="♙" title="Pacientes" text="Consultar las fichas registradas." onClick={() => setSection("pacientes")} /></div>
  </section>;
}

function Stat({ label, value }) { return <div className="stat"><span>{label}</span><b>{value}</b></div>; }
function Quick({ icon, title, text, onClick }) { return <button className="quick" onClick={onClick}><i>{icon}</i><div><b>{title}</b><p>{text}</p></div><span>→</span></button>; }

function PatientProfile({ patient }) {
  if (!patient) return <section className="content"><div className="empty">No se encontró la ficha del paciente.</div></section>;
  return <section className="content narrow-content">
    <div className="section-head"><div><span className="eyebrow">MI INFORMACIÓN</span><h2>{patient.nombre}</h2><p>Datos registrados en HealthChain.</p></div></div>
    <div className="two-col">
      <div className="panel"><h3>Identificación</h3><Info label="ID" value={patient.id} /><Info label="DUI" value={patient.dui} /><Info label="Fecha de nacimiento" value={patient.fecha_nacimiento} /><Info label="Tipo de sangre" value={patient.tipo_sangre} /></div>
      <div className="panel"><h3>Información clínica</h3><Info label="Alergias" value={patient.alergias} /><Info label="Vacunas" value={patient.vacunas} /><Info label="Enfermedades crónicas" value={patient.cronicas} /></div>
    </div>
  </section>;
}
function Info({ label, value }) { return <p className="muted"><b>{label}:</b> {value || "—"}</p>; }

function Patients({ patients, role, onSelect, onNew }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">{role === "PROFESIONAL" ? "ATENCIÓN CLÍNICA" : "CONSULTA"}</span><h2>Pacientes</h2><p>{role === "PROFESIONAL" ? "Registra pacientes y consulta sus fichas." : "Consulta las fichas registradas."}</p></div>{role === "PROFESIONAL" && <button className="primary" onClick={onNew}>＋ Registrar paciente</button>}</div>
    <div className="patient-grid">{patients.map((patient) => <button className="patient" key={patient.id} onClick={() => onSelect(patient)}><div className="patient-avatar">{patient.nombre?.[0]}</div><div><b>{patient.nombre}</b><span>{patient.id}</span><small>DUI: {patient.dui || "—"} · Sangre: {patient.tipo_sangre || "—"}</small></div><strong>→</strong></button>)}</div>
    {!patients.length && <div className="empty">No hay pacientes registrados.</div>}
  </section>;
}

function History({ patient, history, loading, role, onBack }) {
  return <section className="content">
    {role !== "PACIENTE" && <button className="back" onClick={onBack}>← Pacientes</button>}
    <div className="profile"><div className="patient-avatar big">{patient?.nombre?.[0] || "P"}</div><div><span className="eyebrow">{role === "PACIENTE" ? "MI HISTORIAL" : "HISTORIAL CLÍNICO"}</span><h2>{patient?.nombre || "Paciente"}</h2><p>{patient?.id || ""} · Sangre {patient?.tipo_sangre || "—"} · DUI {patient?.dui || "—"}</p></div></div>
    <div className="panel" style={{ marginBottom: 14 }}><h3>Antecedentes</h3><div className="clinical-grid"><Field label="Alergias" value={patient?.alergias} /><Field label="Vacunas" value={patient?.vacunas} /><Field label="Crónicas" value={patient?.cronicas} /><Field label="Tipo de sangre" value={patient?.tipo_sangre} /></div></div>
    {loading ? <div className="empty">Consultando historial…</div> : history.length ? <div className="timeline">{history.map((item, index) => <HistoryItem key={`${item.id || item.block_id}-${index}`} item={item} index={index} />)}</div> : <div className="empty">Este paciente todavía no tiene eventos clínicos registrados en la Blockchain.</div>}
  </section>;
}

function HistoryItem({ item, index }) {
  const data = item.datos || {};
  if (item.virtual) return <article className="timeline-item"><div className="timeline-dot">F</div><div className="record-card"><div className="record-top"><div><span>FICHA</span><h3>Registro inicial del paciente</h3></div><time>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "Sin fecha"}</time></div><div className="clinical-grid"><Field label="Alergias" value={data.alergias} /><Field label="Vacunas" value={data.vacunas} /><Field label="Crónicas" value={data.cronicas} /><Field label="Sangre" value={data.tipo_sangre} /></div><small>Información de la ficha · todavía no es un bloque clínico.</small></div></article>;
  return <article className="timeline-item"><div className="timeline-dot">{index + 1}</div><div className="record-card"><div className="record-top"><div><span>{item.categoria}</span><h3>{item.entidad_emisora || "Atención clínica"}</h3></div><time>{item.timestamp ? new Date(item.timestamp).toLocaleString() : "Sin fecha"}</time></div><div className="clinical-grid"><Field label="Diagnóstico" value={data.diagnostico} /><Field label="Tratamiento" value={data.tratamiento} /><Field label="Observaciones" value={data.observaciones} /><Field label="Signos vitales" value={data.signos_vitales} /></div><small>Bloque #{item.block_id ?? "—"} · Registro clínico cifrado</small></div></article>;
}
function Field({ label, value }) { return <div><span>{label}</span><b>{value || "—"}</b></div>; }

function RecordForm({ patients, selected, setSelected, record, setRecord, onSubmit }) {
  const update = (key, value) => setRecord((old) => ({ ...old, [key]: value }));
  return <section className="content narrow-content">
    <div className="section-head"><div><span className="eyebrow">EVENTO CLÍNICO</span><h2>Registrar atención</h2><p>La información se cifra, se mina en el servidor TCP activo y se propaga a los demás nodos.</p></div></div>
    <form className="panel-form" onSubmit={onSubmit}>
      <label>Paciente<select value={selected?.id || ""} onChange={(e) => setSelected(patients.find((p) => p.id === e.target.value) || null)} required><option value="">Seleccionar paciente</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.id}</option>)}</select></label>
      <label>Tipo de atención<select value={record.category} onChange={(e) => update("category", e.target.value)}><option>CONSULTA</option><option>EMERGENCIA</option><option>DIAGNOSTICO</option><option>LABORATORIO</option><option>VACUNA</option><option>SEGUIMIENTO</option></select></label>
      <label>Diagnóstico<input value={record.diagnostico} onChange={(e) => update("diagnostico", e.target.value)} placeholder="Diagnóstico realizado" required /></label>
      <label>Tratamiento<input value={record.tratamiento} onChange={(e) => update("tratamiento", e.target.value)} placeholder="Tratamiento o indicaciones" required /></label>
      <label>Signos vitales<input value={record.signos_vitales} onChange={(e) => update("signos_vitales", e.target.value)} placeholder="Ej. PA 120/80 · FC 72" /></label>
      <label>Observaciones<input value={record.observaciones} onChange={(e) => update("observaciones", e.target.value)} placeholder="Observaciones de la atención" required /></label>
      <button className="primary form-submit" type="submit">Guardar atención y minar bloque</button>
    </form>
  </section>;
}

function PatientModal({ form, setForm, onSubmit, onClose, loading }) {
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">NUEVO PACIENTE</span><h2>Registrar paciente</h2><p>La ficha se guarda en pacientes.json y queda disponible para futuras atenciones.</p></div><button className="icon-button" onClick={onClose}>×</button></div>
    <form className="patient-form" onSubmit={onSubmit}>
      <div className="form-section-title">Identificación</div>
      <label>Nombre completo<input value={form.nombre} onChange={(e) => update("nombre", e.target.value)} required /></label>
      <label>DUI<input value={form.dui} onChange={(e) => update("dui", e.target.value)} required /></label>
      <label>Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={(e) => update("fecha_nacimiento", e.target.value)} required /></label>
      <label>Tipo de sangre<select value={form.tipo_sangre} onChange={(e) => update("tipo_sangre", e.target.value)} required><option value="">Seleccionar</option><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label>
      <div className="form-section-title">Información clínica inicial</div>
      <label>Alergias<input placeholder="Ej. Penicilina, mariscos o Ninguna" value={form.alergias} onChange={(e) => update("alergias", e.target.value)} required /></label>
      <label>Vacunas<input placeholder="Ej. COVID-19, influenza o Ninguna" value={form.vacunas} onChange={(e) => update("vacunas", e.target.value)} required /></label>
      <label>Enfermedades crónicas<input placeholder="Ej. Asma, diabetes o Ninguna" value={form.cronicas} onChange={(e) => update("cronicas", e.target.value)} required /></label>
      <div className="form-section-title">Contacto</div>
      <label>Teléfono<input value={form.telefono} onChange={(e) => update("telefono", e.target.value)} /></label>
      <label>Dirección<input value={form.direccion} onChange={(e) => update("direccion", e.target.value)} /></label>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={loading}>{loading ? "Guardando…" : "Registrar paciente"}</button></div>
    </form>
  </div></div>;
}

function Blockchain({ chain, blocks, loading, genesis, setGenesis, onGenesis, selectedNode }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">ADMINISTRACIÓN TÉCNICA</span><h2>Blockchain</h2><p>{selectedNode ? `Estado de ${selectedNode}: Genesis, bloques, Proof of Work e integridad.` : "Selecciona un nodo activo."}</p></div><span className={chain?.valid ? "status ok" : "status"}>{chain?.valid ? "Cadena válida" : "Pendiente"}</span></div>
    <div className="stats"><Stat label="Bloques" value={chain?.blocks ?? 0} /><Stat label="Complejidad" value={chain?.complexity ?? "—"} /><Stat label="Proof" value={chain?.proof_of_work || "—"} /><Stat label="Estado" value={loading ? "…" : chain?.valid ? "Íntegra" : "Pendiente"} /></div>
    <div className="two-col"><div className="panel"><h3>Inicializar Genesis</h3><p className="muted">El servidor seleccionado ya tiene su configuración de Proof of Work. Genesis crea únicamente el bloque <b>#0</b>. Los registros clínicos posteriores serán los bloques siguientes.</p><div className="inline-form"><span className="status">Complejidad {chain?.complexity ?? 4}</span><span className="status">Proof {chain?.proof_of_work ?? "0000"}</span><button className="primary" onClick={onGenesis} disabled={loading || !selectedNode || (chain?.blocks ?? 0) > 0}>{chain?.blocks ? "Genesis ya creado" : "Crear Genesis"}</button></div></div><div className="panel"><h3>Bloques almacenados</h3><div className="block-list">{blocks.map((block) => <div className="block-row" key={block.hash}><b>#{block.id}</b><span>{block.hash}</span><small>nonce {block.nonce}</small></div>)}{!blocks.length && <div className="empty">No hay bloques en este nodo.</div>}</div></div></div>
  </section>;
}

function Network({ nodes, form, setForm, onCreate, onStart, onStop, onDelete }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">INFRAESTRUCTURA</span><h2>Red de nodos</h2><p>Servidores TCP/IP reales. Cada nodo mantiene su propia copia de la Blockchain.</p></div><span className="status ok">{nodes.filter((n) => n.running).length} activos</span></div>
    <div className="network-layout"><div className="node-stack">{nodes.map((node) => <div className="node-card" key={node.name}><div className="node-icon">⌁</div><div className="node-main"><span>{node.name}</span><b>{node.ip}:{node.port}</b><small>{node.pid ? `PID ${node.pid} · ` : ""}{node.running ? "Servidor escuchando por TCP" : "Servidor detenido"}</small></div><strong className={node.running ? "node-on" : "node-off"}>{node.running ? "ACTIVO" : "DETENIDO"}</strong><div className="node-actions">{node.running ? <button onClick={() => onStop(node.name)}>Detener</button> : <button onClick={() => onStart(node.name)}>Iniciar</button>}{!node.running && <button className="danger-link" onClick={() => onDelete(node.name)}>Eliminar</button>}</div></div>)}{!nodes.length && <div className="empty">No hay servidores configurados.</div>}</div><form className="panel node-create" onSubmit={onCreate}><h3>Crear servidor</h3><p>Configura una nueva instancia de la red.</p><label>Nombre<input placeholder="NODO_3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>IP<input placeholder="127.0.0.1" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} required /></label><label>Puerto<input type="number" min="1024" max="65535" placeholder="5003" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} required /></label><button className="primary">＋ Crear servidor</button></form></div>
    <div className="network-flow"><span>Wallet / Cliente</span><b>TCP/IP</b><span>NODO_1</span><b>broadcast</b><span>NODO_2</span></div>
  </section>;
}
