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

export default function DashboardPage({ user, onLogout }) {
  const role = user.rol;
  const [section, setSection] = useState(role === "PACIENTE" ? "historial" : "inicio");
  const [nodes, setNodes] = useState(() => { try { return JSON.parse(localStorage.getItem("healthchain_nodes") || localStorage.getItem("healthchain_nodes_cache") || "[]"); } catch { return []; } });
  const [selectedNode, setSelectedNode] = useState(() => localStorage.getItem("healthchain_selected_node") || "");
  const [patients, setPatients] = useState(() => { try { return JSON.parse(localStorage.getItem("healthchain_patients") || localStorage.getItem("healthchain_patients_cache") || "[]"); } catch { return []; } });
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
  const [patientForm, setPatientForm] = useState({
    nombre: "", dui: "", fecha_nacimiento: "", tipo_sangre: "", alergias: "", vacunas: "", cronicas: "", telefono: "", direccion: "",
  });
  const [record, setRecord] = useState({ category: "CONSULTA", blood: "", allergies: "", vaccines: "", chronic: "" });

  const activeNodes = useMemo(() => nodes.filter((n) => n.running), [nodes]);

  async function loadNodes() {
    try {
      const r = await getNodes();
      const nextNodes = r.nodes || [];
      localStorage.setItem("healthchain_nodes_cache", JSON.stringify(nextNodes));
      localStorage.setItem("healthchain_nodes", JSON.stringify(nextNodes));
      setNodes(nextNodes);
      const saved = localStorage.getItem("healthchain_active_node") || localStorage.getItem("healthchain_selected_node");
      const savedNode = nextNodes.find((n) => n.name === saved);
      const preferred = savedNode?.running ? savedNode.name : nextNodes.find((n) => n.running)?.name || nextNodes[0]?.name || "";
      if (preferred && preferred !== selectedNode) {
        setSelectedNode(preferred);
        localStorage.setItem("healthchain_selected_node", preferred);
        localStorage.setItem("healthchain_active_node", preferred);
      }
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem("healthchain_nodes_cache") || "[]");
        setNodes(cached);
        const active = cached.find((n) => n.running);
        if (active) {
          setSelectedNode(active.name);
          localStorage.setItem("healthchain_selected_node", active.name);
          localStorage.setItem("healthchain_active_node", active.name);
        }
      } catch {}
      setError(e.message);
    }
  }

  async function loadPatients() {
    try {
      const r = await getPatients();
      const nextPatients = r.pacientes || [];
      setPatients(nextPatients);
      localStorage.setItem("healthchain_patients_cache", JSON.stringify(nextPatients));
    } catch (e) {
      try { setPatients(JSON.parse(localStorage.getItem("healthchain_patients") || localStorage.getItem("healthchain_patients_cache") || "[]")); } catch {}
      setError(e.message);
    }
  }

  async function loadChain() {
    if (!selectedNode) return;
    setLoading(true);
    setError("");
    try {
      const [s, b] = await Promise.all([
        getBlockchainStatus(selectedNode),
        getBlockchainBlocks(selectedNode),
      ]);
      setChain(s);
      setBlocks(b.blocks || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadHistory(patient) {
    setSelectedPatient(patient);
    setSection("historial");
    setMobileMenu(false);
    setLoading(true);
    setError("");
    try {
      const r = await getPatientHistory(patient.id, selectedNode);
      if (r.paciente) setSelectedPatient(r.paciente);
      setHistory(r.historial || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNodes();
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedNode) {
      localStorage.setItem("healthchain_selected_node", selectedNode);
      const active = nodes.find((node) => node.name === selectedNode && node.running);
      if (active) localStorage.setItem("healthchain_active_node", selectedNode);
      else localStorage.removeItem("healthchain_active_node");
    }
    if (section === "blockchain") loadChain();
    if (section === "red") loadNodes();
  }, [section, selectedNode]);

  useEffect(() => {
    if (role === "PACIENTE" && user.paciente_id && patients.length) {
      const patient = patients.find((x) => x.id === user.paciente_id) || {
        id: user.paciente_id,
        nombre: user.nombre,
      };
      loadHistory(patient);
    }
  }, [patients, selectedNode]);

  async function action(fn, success = "Operación completada.") {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await fn();
      setMessage(success);
      await loadNodes();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createServer(e) {
    e.preventDefault();
    await action(async () => {
      await createNode(nodeForm);
      setNodeForm({ name: "", ip: "127.0.0.1", port: "" });
    }, "Servidor configurado correctamente.");
  }

  async function registerPatient(e) {
    e.preventDefault();
    await action(async () => {
      const r = await createPatient(patientForm);
      if (!r.success) throw new Error(r.message || "No fue posible registrar al paciente.");
      const cached = (() => { try { return JSON.parse(localStorage.getItem("healthchain_patients_cache") || "[]"); } catch { return []; } })();
      const updatedPatients = [...cached.filter((p) => p.id !== r.paciente?.id), ...(r.paciente ? [r.paciente] : [])];
      localStorage.setItem("healthchain_patients_cache", JSON.stringify(updatedPatients));
      localStorage.setItem("healthchain_patients", JSON.stringify(updatedPatients));
      setPatientForm({ nombre: "", dui: "", fecha_nacimiento: "", tipo_sangre: "", alergias: "", vacunas: "", cronicas: "", telefono: "", direccion: "" });
      setShowPatientForm(false);
      await loadPatients();
    }, "Paciente registrado correctamente.");
  }

  async function submitRecord(e) {
    e.preventDefault();
    if (!selectedPatient) return setError("Selecciona un paciente.");
    if (!activeNodes.length) return setError("No hay un servidor HealthChain activo.");
    const node = selectedNode || activeNodes[0].name;
    await action(async () => {
      const r = await createClinicalRecord({
        paciente_id: selectedPatient.id,
        categoria: record.category,
        datos: {
          nombre: selectedPatient.nombre,
          tipo_sangre: record.blood,
          alergias: record.allergies,
          vacunas: record.vaccines,
          cronicas: record.chronic,
        },
        node,
      });
      if (!r.success) throw new Error(r.message || "No fue posible crear el registro.");
      setSelectedNode(node);
      await loadHistory(selectedPatient);
    }, "Registro clínico minado y propagado.");
  }

  async function doGenesis(e) {
    e.preventDefault();
    const activeNode = selectedNode && nodes.find((n) => n.name === selectedNode && n.running) ? selectedNode : (nodes.find((n) => n.running)?.name || localStorage.getItem("healthchain_active_node"));
    if (!activeNode) return setError("Selecciona un servidor activo.");
    if (chain?.blocks > 0) return setMessage("La Blockchain ya está inicializada en este nodo.");
    await action(async () => {
      const r = await createGenesis(Number(genesis.complexity), genesis.proof, activeNode);
      if (!r.success) throw new Error(r.message || "No fue posible crear Genesis.");
      setSelectedNode(activeNode);
      localStorage.setItem("healthchain_selected_node", activeNode);
      localStorage.setItem("healthchain_active_node", activeNode);
      await loadChain();
    }, "Genesis creado y propagado.");
  }

  const nav = role === "ADMIN"
    ? [
        ["inicio", "⌂", "Inicio"],
        ["pacientes", "♙", "Pacientes"],
        ["historial", "◷", "Historial"],
        ["blockchain", "◈", "Blockchain"],
        ["red", "⌁", "Red de nodos"],
      ]
    : role === "PROFESIONAL"
      ? [
          ["inicio", "⌂", "Inicio"],
          ["pacientes", "♙", "Pacientes"],
          ["historial", "◷", "Historial"],
          ["registro", "＋", "Registrar atención"],
        ]
      : [["historial", "◷", "Mi historial"]];

  function navigate(id) {
    setSection(id);
    setMessage("");
    setError("");
    setMobileMenu(false);
    if (id === "pacientes") loadPatients();
    if (id === "blockchain") loadChain();
  }

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
        <nav>{nav.map(([id, icon, label]) => (
          <button key={id} className={section === id ? "nav-link active" : "nav-link"} onClick={() => navigate(id)}>
            <span>{icon}</span>{label}
          </button>
        ))}</nav>
        <button className="logout" onClick={onLogout}>↪ Cerrar sesión</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-title">
            <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú">☰</button>
            <div><span className="eyebrow">MESSI HEALTHCHAIN</span><h1>{nav.find((x) => x[0] === section)?.[2] || "Inicio"}</h1></div>
          </div>
          <div className="top-actions">
            {role === "ADMIN" && nodes.length > 0 && (
              <select value={selectedNode} onChange={(e) => { const value = e.target.value; setSelectedNode(value); localStorage.setItem("healthchain_selected_node", value); const node = nodes.find((n) => n.name === value); if (node?.running) localStorage.setItem("healthchain_active_node", value); else localStorage.removeItem("healthchain_active_node"); }} aria-label="Servidor">
                {nodes.map((n) => <option key={n.name} value={n.name}>{n.name} · {n.running ? "Activo" : "Detenido"}</option>)}
              </select>
            )}
            <div className="role-chip">{roleLabel[role]}</div>
          </div>
        </header>

        {message && <div className="alert success">✓ {message}</div>}
        {error && <div className="alert danger">{error}</div>}

        {section === "inicio" && <Home user={user} role={role} nodes={nodes} active={activeNodes.length} setSection={navigate} />}
        {section === "pacientes" && <Patients patients={patients} role={role} onSelect={loadHistory} onNew={() => setShowPatientForm(true)} />}
        {section === "historial" && <History patient={selectedPatient} history={history} loading={loading} role={role} onBack={() => navigate("pacientes")} />}
        {section === "registro" && <RecordForm patients={patients} selected={selectedPatient} setSelected={setSelectedPatient} record={record} setRecord={setRecord} onSubmit={submitRecord} />}
        {section === "blockchain" && <Blockchain chain={chain} blocks={blocks} loading={loading} genesis={genesis} setGenesis={setGenesis} onGenesis={doGenesis} />}
        {section === "red" && <Network nodes={nodes} form={nodeForm} setForm={setNodeForm} onCreate={createServer} onStart={(n) => action(() => startNode(n), `${n} iniciado.`)} onStop={(n) => action(() => stopNode(n), `${n} detenido.`)} onDelete={(n) => action(() => deleteNode(n), `${n} eliminado.`)} />}
      </main>

      {showPatientForm && <PatientModal form={patientForm} setForm={setPatientForm} onSubmit={registerPatient} onClose={() => setShowPatientForm(false)} loading={loading} />}
    </div>
  );
}

function Home({ user, role, nodes, active, setSection }) {
  if (role === "PACIENTE") {
    return <section className="content">
      <div className="welcome-card patient-welcome"><div><span className="eyebrow">BIENVENIDO</span><h2>{user.nombre}</h2><p>Consulta tu información y tu historial clínico.</p></div><div className="welcome-icon">◷</div></div>
      <div className="quick-grid patient-quick"><Quick icon="◷" title="Mi historial" text="Consulta tus registros clínicos." onClick={() => setSection("historial")} /></div>
    </section>;
  }

  if (role === "PROFESIONAL") {
    return <section className="content">
      <div className="welcome-card professional-welcome"><div><span className="eyebrow">ÁREA CLÍNICA</span><h2>{user.nombre}</h2><p>Registra pacientes, consulta historiales y documenta atenciones clínicas.</p></div><div className="welcome-icon">✚</div></div>
      <div className="quick-grid professional-quick">
        <Quick icon="♙" title="Pacientes" text="Buscar y registrar pacientes." onClick={() => setSection("pacientes")} />
        <Quick icon="＋" title="Registrar atención" text="Agregar información clínica al historial." onClick={() => setSection("registro")} />
        <Quick icon="◷" title="Historial" text="Consultar la historia de un paciente." onClick={() => setSection("historial")} />
      </div>
    </section>;
  }

  return <section className="content">
    <div className="welcome-card admin-welcome"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>{user.nombre}</h2><p>Gestiona pacientes, Blockchain y la infraestructura de nodos de HealthChain.</p></div><div className="welcome-icon">⌘</div></div>
    <div className="stats"><Stat label="Nodos activos" value={active} /><Stat label="Nodos configurados" value={nodes.length} /><Stat label="Pacientes" value="Gestión" /><Stat label="Red" value="TCP/IP" /></div>
    <div className="quick-grid admin-quick">
      <Quick icon="♙" title="Pacientes" text="Consultar y administrar registros." onClick={() => setSection("pacientes")} />
      <Quick icon="◈" title="Blockchain" text="Genesis, bloques y Proof of Work." onClick={() => setSection("blockchain")} />
      <Quick icon="⌁" title="Red de nodos" text="Servidores y conexiones TCP/IP." onClick={() => setSection("red")} />
    </div>
  </section>;
}

function Stat({ label, value }) { return <div className="stat"><span>{label}</span><b>{value}</b></div>; }
function Quick({ icon, title, text, onClick }) { return <button className="quick" onClick={onClick}><i>{icon}</i><div><b>{title}</b><p>{text}</p></div><span>→</span></button>; }

function Patients({ patients, role, onSelect, onNew }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">ATENCIÓN CLÍNICA</span><h2>Pacientes</h2><p>Consulta la ficha de cada paciente y su historial.</p></div>{(role === "PROFESIONAL" || role === "ADMIN") && <button className="primary" onClick={onNew}>＋ Registrar paciente</button>}</div>
    <div className="patient-grid">{patients.map((p) => <button className="patient" key={p.id} onClick={() => onSelect(p)}><div className="patient-avatar">{p.nombre?.[0]}</div><div><b>{p.nombre}</b><span>{p.id}</span><small>DUI: {p.dui || "—"} · Sangre: {p.tipo_sangre || "—"}</small></div><strong>→</strong></button>)}</div>
    {!patients.length && <div className="empty">No hay pacientes registrados.</div>}
  </section>;
}

function History({ patient, history, loading, role, onBack }) {
  return <section className="content">
    {role !== "PACIENTE" && <button className="back" onClick={onBack}>← Pacientes</button>}
    <div className="profile"><div className="patient-avatar big">{patient?.nombre?.[0] || "P"}</div><div><span className="eyebrow">FICHA DEL PACIENTE</span><h2>{patient?.nombre || "Paciente"}</h2><p>{patient?.id || ""} · Tipo de sangre {patient?.tipo_sangre || "—"} · DUI {patient?.dui || "—"}</p></div></div>
    {loading ? <div className="empty">Consultando historial…</div> : <div className="timeline">{history.map((r, i) => <article className="timeline-item" key={`${r.block_id ?? r.id}-${i}`}><div className="timeline-dot">{i + 1}</div><div className="record-card"><div className="record-top"><div><span>{r.categoria}</span><h3>{r.entidad_emisora}</h3></div><time>{r.timestamp ? new Date(r.timestamp).toLocaleString() : "Sin fecha"}</time></div><div className="clinical-grid"><Field label="Tipo de sangre" value={r.datos?.tipo_sangre} /><Field label="Alergias" value={r.datos?.alergias} /><Field label="Vacunas" value={r.datos?.vacunas} /><Field label="Enfermedades crónicas" value={r.datos?.cronicas} /></div>{r.virtual ? <small className="record-note">Ficha inicial del paciente · aún no corresponde a un bloque clínico.</small> : <small className="record-note">Bloque #{r.block_id} · Registro cifrado</small>}</div></article>)}</div>}
  </section>;
}

function Field({ label, value }) { return <div><span>{label}</span><b>{value || "—"}</b></div>; }

function RecordForm({ patients, selected, setSelected, record, setRecord, onSubmit }) {
  return <section className="content narrow-content">
    <div className="section-head"><div><span className="eyebrow">REGISTRO CLÍNICO</span><h2>Registrar atención</h2><p>Documenta la atención realizada al paciente.</p></div></div>
    <form className="panel-form" onSubmit={onSubmit}>
      <label>Paciente<select value={selected?.id || ""} onChange={(e) => setSelected(patients.find((p) => p.id === e.target.value))}><option value="">Seleccionar paciente</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.nombre} · {p.id}</option>)}</select></label>
      <label>Tipo de atención<select value={record.category} onChange={(e) => setRecord({ ...record, category: e.target.value })}><option>CONSULTA</option><option>VACUNA</option><option>EMERGENCIA</option><option>DIAGNOSTICO</option><option>LABORATORIO</option><option>SEGUIMIENTO</option></select></label>
      <label>Tipo de sangre<input value={record.blood} onChange={(e) => setRecord({ ...record, blood: e.target.value })} required /></label>
      <label>Alergias<input value={record.allergies} onChange={(e) => setRecord({ ...record, allergies: e.target.value })} required /></label>
      <label>Vacunas<input value={record.vaccines} onChange={(e) => setRecord({ ...record, vaccines: e.target.value })} required /></label>
      <label>Enfermedades crónicas<input value={record.chronic} onChange={(e) => setRecord({ ...record, chronic: e.target.value })} required /></label>
      <button className="primary form-submit" type="submit">Guardar atención y registrar en Blockchain</button>
    </form>
  </section>;
}

function PatientModal({ form, setForm, onSubmit, onClose, loading }) {
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">NUEVO PACIENTE</span><h2>Registrar paciente</h2><p>Completa los datos básicos de identificación.</p></div><button className="icon-button" onClick={onClose}>×</button></div>
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

function Blockchain({ chain, blocks, loading, genesis, setGenesis, onGenesis }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">ADMINISTRACIÓN</span><h2>Blockchain</h2><p>Estado de la cadena, Genesis y Proof of Work.</p></div><span className={chain?.valid ? "status ok" : "status"}>{chain?.valid ? "Cadena válida" : "Pendiente"}</span></div>
    <div className="stats"><Stat label="Bloques" value={chain?.blocks ?? 0} /><Stat label="Complejidad" value={chain?.complexity ?? "—"} /><Stat label="Proof" value={chain?.proof_of_work || "—"} /><Stat label="Estado" value={loading ? "…" : chain?.valid ? "Íntegra" : "Pendiente"} /></div>
    <div className="two-col"><div className="panel"><h3>Inicializar Genesis</h3><form className="inline-form" onSubmit={onGenesis}><input type="number" min="1" max="6" value={genesis.complexity} onChange={(e) => setGenesis({ ...genesis, complexity: e.target.value })} /><input maxLength="1" value={genesis.proof} onChange={(e) => setGenesis({ ...genesis, proof: e.target.value })} /><button className="primary" disabled={loading || (chain?.blocks ?? 0) > 0}>{chain?.blocks ? "Genesis ya creado" : "Crear Genesis"}</button></form><p className="muted">Se crea en el nodo seleccionado y se propaga al resto de la red.</p></div><div className="panel"><h3>Bloques almacenados</h3><div className="block-list">{blocks.map((b) => <div className="block-row" key={b.hash}><b>#{b.id}</b><span>{b.hash}</span><small>nonce {b.nonce}</small></div>)}</div></div></div>
  </section>;
}

function Network({ nodes, form, setForm, onCreate, onStart, onStop, onDelete }) {
  return <section className="content">
    <div className="section-head"><div><span className="eyebrow">INFRAESTRUCTURA</span><h2>Red de nodos</h2><p>Servidores TCP/IP reales de HealthChain.</p></div><span className="status ok">{nodes.filter((n) => n.running).length} activos</span></div>
    <div className="network-layout"><div className="node-stack">{nodes.map((n) => <div className="node-card" key={n.name}><div className="node-icon">⌁</div><div className="node-main"><span>{n.name}</span><b>{n.ip}:{n.port}</b><small>{n.pid ? `PID ${n.pid} · ` : ""}{n.running ? "Servidor escuchando" : "Servidor detenido"}</small></div><strong className={n.running ? "node-on" : "node-off"}>{n.running ? "ACTIVO" : "DETENIDO"}</strong><div className="node-actions">{n.running ? <button onClick={() => onStop(n.name)}>Detener</button> : <button onClick={() => onStart(n.name)}>Iniciar</button>}{!n.running && <button className="danger-link" onClick={() => onDelete(n.name)}>Eliminar</button>}</div></div>)}</div><form className="panel node-create" onSubmit={onCreate}><h3>Crear servidor</h3><p>Configura una nueva instancia de la red.</p><label>Nombre<input placeholder="NODO_1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>IP<input placeholder="127.0.0.1" value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} required /></label><label>Puerto<input type="number" min="1024" max="65535" placeholder="5001" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} required /></label><button className="primary">＋ Crear servidor</button></form></div>
    <div className="network-flow"><span>Wallet / Cliente</span><b>TCP/IP</b><span>Servidor</span><b>broadcast</b><span>Otros nodos</span></div>
  </section>;
}
