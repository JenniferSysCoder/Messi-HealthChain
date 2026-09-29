import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  createClinicalRecord, createGenesis, createNode, createPatient, deleteNode,
  getBlockchainBlocks, getBlockchainStatus, getNodes, getPatientHistory,
  getPatients, startNode, stopNode, validateProfessional,
} from "../services/api";

const emptyPatient = { nombre:"", dui:"", fecha_nacimiento:"", tipo_sangre:"", alergias:"", vacunas:"", cronicas:"", telefono:"", direccion:"" };
const emptyRecord = { category:"CONSULTA", motivo_consulta:"", diagnostico:"", tratamiento:"", observaciones:"", signos_vitales:"" };
const nav = [
  ["inicio", "⌂", "Inicio"],
  ["pacientes", "♙", "Pacientes"],
  ["paciente-nuevo", "＋", "Registrar paciente"],
  ["historial", "◷", "Historial clínico"],
  ["registro", "≡", "Registro clínico"],
  ["blockchain", "⛓", "Blockchain"],
  ["red", "⌁", "Nodos / Servidores"],
];

export default function DashboardPage() {
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
  const [patientCredential, setPatientCredential] = useState(null);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [record, setRecord] = useState(emptyRecord);
  const [nodeForm, setNodeForm] = useState({ name:"", ip:"127.0.0.1", port:"" });

  const activeNodes = useMemo(() => nodes.filter(n => n.running), [nodes]);
  const pageTitle = nav.find(n => n[0] === section)?.[2] || "Inicio";

  useEffect(() => { loadPatients(); loadNodes(); }, []);
  useEffect(() => { if (section === "blockchain") loadChain(); if (section === "red") loadNodes(); }, [section, selectedNode]);

  async function loadPatients() {
    try { const r = await getPatients(); setPatients(r.pacientes || []); }
    catch (e) { setError(e.message); setPatients(readLocal("healthchain_patients", [])); }
  }
  async function loadNodes() {
    try {
      const r = await getNodes(); const list = r.nodes || []; setNodes(list);
      const preferred = list.find(n => n.name === localStorage.getItem("healthchain_selected_node") && n.running) || list.find(n => n.running);
      if (preferred) { setSelectedNode(preferred.name); localStorage.setItem("healthchain_selected_node", preferred.name); }
    } catch (e) { setNodes(readLocal("healthchain_nodes", [])); setError(e.message); }
  }
  async function loadChain() {
    if (!selectedNode) return;
    setLoading(true); setError("");
    try { const [s,b] = await Promise.all([getBlockchainStatus(selectedNode), getBlockchainBlocks(selectedNode)]); setChain(s); setBlocks(b.blocks || []); }
    catch(e) { setError(e.message); } finally { setLoading(false); }
  }

  async function openPatientRegistration() {
    const credential = await askProfessionalCredentials("Autorización para registrar paciente");
    if (!credential) return;
    setPatientCredential(credential);
    setPatientForm(emptyPatient);
    setShowPatientForm(true);
  }

  async function openHistoryFromMenu() {
    const credential = await askProfessionalCredentials("Acceso a consulta de pacientes");
    if (!credential) return;
    await loadPatients();
    if (selectedPatient) {
      setSection("historial");
      setLoading(true);
      try {
        const r = await getPatientHistory(selectedPatient.id, selectedNode, credential);
        setSelectedPatient(r.paciente || selectedPatient);
        setHistory(r.historial || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    } else {
      setSection("pacientes");
      setMessage("Acceso autorizado. Selecciona un paciente para realizar la consulta.");
    }
  }

  async function navigate(id) {
    setMessage(""); setError(""); setMobileMenu(false);
    if (id === "paciente-nuevo") { await openPatientRegistration(); return; }
    if (id === "historial") { await openHistoryFromMenu(); return; }
    setSection(id);
    if (id === "pacientes" || id === "registro") loadPatients();
  }

  async function askProfessionalCredentials(title = "Validación profesional") {
    const result = await Swal.fire({
      title,
      html: `<p style="margin:0 0 14px;color:#718087;font-size:13px">Ingresa tu registro profesional para continuar.</p>
        <select id="hc-tipo" class="swal2-select" style="width:100%;margin:8px 0"><option value="JVPM">JVPM — Medicina</option><option value="JVPP">JVPP — Psicología</option><option value="JVPO">JVPO — Odontología</option><option value="JVPE">JVPE — Enfermería</option></select>
        <input id="hc-registro" class="swal2-input" style="width:100%;margin:8px 0" placeholder="Ej. JVPM-12345">`,
      confirmButtonText: "Validar acceso", cancelButtonText: "Cancelar", showCancelButton: true,
      preConfirm: async () => {
        const tipo = document.getElementById("hc-tipo").value;
        const registro = document.getElementById("hc-registro").value.trim();
        if (!registro) { Swal.showValidationMessage("Ingresa el número de registro profesional."); return false; }
        Swal.showLoading();
        try { const r = await validateProfessional(tipo, registro); return { tipo, registro, profesional:r.profesional }; }
        catch (e) { Swal.showValidationMessage(e.message || "Credenciales inválidas."); return false; }
      }
    });
    if (!result.isConfirmed) return null;
    await Swal.fire({ icon:"success", title:"Acceso autorizado", text:`Credencial ${result.value.tipo} validada correctamente.`, timer:1700, showConfirmButton:false });
    return result.value;
  }

  async function openHistory(patient) {
    const credential = await askProfessionalCredentials("Acceso al historial clínico");
    if (!credential) return;
    setLoading(true); setError(""); setSelectedPatient(patient); setSection("historial");
    try { const r = await getPatientHistory(patient.id, selectedNode, credential); setSelectedPatient(r.paciente || patient); setHistory(r.historial || []); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function registerPatient(e) {
    e.preventDefault();
    const credential = patientCredential;
    if (!credential) {
      await Swal.fire({ icon:"warning", title:"Acceso requerido", text:"Primero debes validar tus credenciales profesionales para registrar un paciente." });
      return;
    }
    setLoading(true); setError("");
    try {
      const r = await createPatient(patientForm, credential);
      if (!r.success) throw new Error(r.message);
      setPatientForm(emptyPatient); setPatientCredential(null); setShowPatientForm(false); await loadPatients();
      await Swal.fire({ icon:"success", title:"Paciente registrado", text:"La ficha se guardó en pacientes.json.", confirmButtonText:"Continuar" });
    } catch(e) { setError(e.message); await Swal.fire({icon:"error", title:"No se pudo registrar", text:e.message}); }
    finally { setLoading(false); }
  }

  async function submitRecord(e) {
    e.preventDefault(); if (!selectedPatient) { setError("Selecciona un paciente."); return; }
    const credential = await askProfessionalCredentials("Validación para registrar atención"); if (!credential) return;
    setLoading(true); setError("");
    try {
      const r = await createClinicalRecord({ paciente_id:selectedPatient.id, categoria:record.category, datos:{ motivo_consulta:record.motivo_consulta, diagnostico:record.diagnostico, tratamiento:record.tratamiento, observaciones:record.observaciones, signos_vitales:record.signos_vitales } }, credential);
      if (!r.success) throw new Error(r.message);
      setRecord(emptyRecord); await openHistory(selectedPatient);
      await Swal.fire({icon:"success", title:"Atención registrada", text:"El registro fue minado y agregado a la Blockchain.", confirmButtonText:"Continuar"});
    } catch(e) { setError(e.message); await Swal.fire({icon:"error", title:"No se pudo registrar", text:e.message}); }
    finally { setLoading(false); }
  }

  async function run(action, ok) { setLoading(true); setError(""); setMessage(""); try { await action(); setMessage(ok); await loadNodes(); } catch(e) { setError(e.message); } finally { setLoading(false); } }
  async function createServer(e) { e.preventDefault(); await run(async()=>{await createNode(nodeForm);setNodeForm({name:"",ip:"127.0.0.1",port:""});},"Servidor configurado correctamente."); }
  async function confirmDeleteServer(name) {
    const result = await Swal.fire({ title:"¿Eliminar servidor?", text:`Se eliminará la configuración de ${name}.`, icon:"warning", showCancelButton:true, confirmButtonText:"Eliminar", cancelButtonText:"Cancelar", reverseButtons:true });
    if (result.isConfirmed) await run(()=>deleteNode(name),"Servidor eliminado.");
  }
  async function confirmStopServer(name) {
    const result = await Swal.fire({ title:"¿Detener servidor?", text:`El nodo ${name} dejará de atender solicitudes.`, icon:"warning", showCancelButton:true, confirmButtonText:"Detener servidor", cancelButtonText:"Cancelar", reverseButtons:true });
    if (result.isConfirmed) await run(()=>stopNode(name),"Servidor detenido.");
  }
  async function confirmGenesis() {
    const result = await Swal.fire({ title:"¿Crear bloque Genesis?", text:"Esta acción inicializa la cadena en el nodo seleccionado.", icon:"question", showCancelButton:true, confirmButtonText:"Crear Genesis", cancelButtonText:"Cancelar", reverseButtons:true });
    if (result.isConfirmed) await genesis();
  }
  async function genesis() { const node=selectedNode||activeNodes[0]?.name; if(!node){setError("Primero inicia un servidor.");return;} await run(async()=>{const r=await createGenesis(4,"0",node);if(!r.success)throw new Error(r.message);setSelectedNode(node);await loadChain();},"Genesis creado correctamente."); }

  return <div className="app-shell">
    {mobileMenu && <button className="mobile-backdrop" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú" />}
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand side"><div className="brand-mark">M10<span>+</span></div><div><strong>MESSI<br/>HealthChain</strong><small>Historia clínica digital</small></div></div>
      <div className="user-mini"><div className="avatar">DR</div><div><b>Profesional de salud</b><span>Acceso integral del sistema</span></div></div>
      <div className="nav-label">MENÚ</div>
      <nav id="healthchain-navigation" aria-label="Navegación principal">{nav.map(([id,icon,label])=><button key={id} className={section===id||(id==="paciente-nuevo"&&section==="pacientes")?"nav-link active":"nav-link"} onClick={()=>navigate(id)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
      <div className="logout" style={{cursor:"default"}}>● Sistema activo</div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="top-title"><button className="menu-button" onClick={()=>setMobileMenu(open=>!open)} aria-label={mobileMenu?"Cerrar menú":"Abrir menú"} aria-expanded={mobileMenu} aria-controls="healthchain-navigation">☰</button><div className="header-brand"><strong>HealthChain</strong><span>{pageTitle}</span></div></div><div className="top-actions"><span className={`system-status ${activeNodes.length?"online":""}`}><i aria-hidden="true"/>{activeNodes.length} nodos activos</span>{activeNodes.length>0&&<select value={selectedNode} onChange={e=>{setSelectedNode(e.target.value);localStorage.setItem("healthchain_selected_node",e.target.value)}} aria-label="Nodo seleccionado"><option value="">Nodo activo</option>{activeNodes.map(n=><option key={n.name}>{n.name}</option>)}</select>}</div></header>
      {message&&<div className="alert success">{message}</div>}{error&&<div className="alert danger">{error}</div>}
      {section==="inicio"&&<Home patients={patients} active={activeNodes.length} blocks={chain?.blocks} chain={chain} setSection={navigate} />}
      {section==="pacientes"&&<Patients patients={patients} onNew={openPatientRegistration} onSelect={openHistory} />}
      {section==="historial"&&<History patient={selectedPatient} history={history} loading={loading} onBack={()=>navigate("pacientes")} />}
      {section==="registro"&&<RecordForm patients={patients} selected={selectedPatient} setSelected={setSelectedPatient} record={record} setRecord={setRecord} onSubmit={submitRecord}/>} 
      {section==="blockchain"&&<Blockchain chain={chain} blocks={blocks} loading={loading} onGenesis={confirmGenesis} selectedNode={selectedNode}/>} 
      {section==="red"&&<Network nodes={nodes} form={nodeForm} setForm={setNodeForm} loading={loading} onCreate={createServer} onStart={(n)=>run(()=>startNode(n),"Servidor iniciado.")} onStop={confirmStopServer} onDelete={confirmDeleteServer}/>} 
      {showPatientForm&&<PatientModal form={patientForm} setForm={setPatientForm} onSubmit={registerPatient} onClose={()=>setShowPatientForm(false)} loading={loading}/>} 
    </main>
  </div>;
}

function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}}
function Home({patients,active,blocks,chain,setSection}){return <section className="content"><div className="welcome-card professional-welcome"><div><span className="eyebrow">GESTIÓN CLÍNICA</span><h2>Todo el sistema en un solo lugar.</h2><p>Administra pacientes, registros clínicos, Blockchain y nodos desde una única interfaz.</p></div></div><div className="stats"><Stat icon="♙" label="Pacientes registrados" value={patients.length} description="Fichas disponibles"/><Stat icon="⛓" label="Estado Blockchain" value={chain?(chain.valid?"Íntegra":"Revisar") : "Sin consultar"} description={chain?"Estado de integridad":"Abre Blockchain para consultar"}/><Stat icon="⌁" label="Nodos activos" value={active} description="Servidores disponibles"/><Stat icon="#" label="Bloques" value={blocks??"—"} description="En el nodo seleccionado"/></div><h3>Acciones rápidas</h3><div className="quick-grid"><button className="quick" onClick={()=>setSection("pacientes")}><i>♙</i><div><b>Gestionar pacientes</b><p>Registrar y consultar fichas.</p></div></button><button className="quick" onClick={()=>setSection("registro")}><i>＋</i><div><b>Nueva atención</b><p>Crear un registro clínico.</p></div></button><button className="quick" onClick={()=>setSection("blockchain")}><i>⛓</i><div><b>Ver Blockchain</b><p>Estado, Genesis y bloques.</p></div></button></div></section>}
function Stat({label,value,icon,description}){return <div className="stat"><div className="stat-heading">{icon&&<span className="stat-icon" aria-hidden="true">{icon}</span>}<span>{label}</span></div><b>{value}</b>{description&&<small>{description}</small>}</div>}
function Patients({patients,onNew,onSelect}){
  return <section className="content">
    <div className="section-head">
      <div>
        <span className="eyebrow">ATENCIÓN CLÍNICA</span>
        <h2>Pacientes</h2>
        <p>Selecciona un paciente para solicitar acceso a su historial.</p>
      </div>
      <button className="primary" onClick={onNew}>＋ Registrar paciente</button>
    </div>
    <div className="patient-grid">
      {patients.map(p=><article className="patient-row" key={p.id}>
        <div className="patient-id"><b>Paciente</b><span>{p.id}</span></div>
        <span className="patient-state"><i aria-hidden="true"/>{p.estado||"Registrado"}</span>
        <time className="patient-date" dateTime={p.fecha_registro||undefined}>{p.fecha_registro?new Date(p.fecha_registro).toLocaleDateString("es-SV"):"Fecha no disponible"}</time>
        <button className="secondary patient-consult" onClick={()=>onSelect(p)}>Consultar</button>
      </article>)}
      {!patients.length&&<div className="empty">No hay pacientes registrados.</div>}
    </div>
  </section>
}
function History({patient,history,loading,onBack}){if(!patient)return <section className="content"><div className="empty">Selecciona un paciente desde Pacientes.</div></section>;return <section className="content"><button className="back" onClick={onBack}>← Pacientes</button><div className="profile"><div className="patient-avatar big">{patient.nombre?.[0]||"P"}</div><div><span className="eyebrow">HISTORIAL CLÍNICO</span><h2>{patient.nombre}</h2><p>{patient.id} · Sangre {patient.tipo_sangre||"—"} · DUI {patient.dui||"—"}</p></div></div>{loading?<div className="loading-state">Consultando historial…</div>:history.length?<div className="timeline">{history.map((item,i)=><HistoryItem item={item} index={i} key={`${item.id||item.block_id}-${i}`}/>)}</div>:<div className="empty">Este paciente todavía no tiene eventos clínicos.</div>}</section>}
function HistoryItem({item,index}){const d=item.datos||{};return <article className="timeline-item"><div className="timeline-dot">{item.virtual?"F":index+1}</div><div className="record-card"><div className="record-top"><div><span>{item.virtual?"FICHA":item.categoria}</span><h3>{item.virtual?"Registro inicial del paciente":item.entidad_emisora||"Atención clínica"}</h3></div><time>{item.timestamp?new Date(item.timestamp).toLocaleString():"Sin fecha"}</time></div><div className="clinical-grid"><Field label="Motivo" value={d.motivo_consulta}/><Field label="Diagnóstico" value={d.diagnostico}/><Field label="Tratamiento" value={d.tratamiento}/><Field label="Observaciones" value={d.observaciones}/></div><small>{item.virtual?"Ficha persistida en JSON.":`Bloque #${item.block_id??"—"} · Registro clínico en Blockchain`}</small></div></article>}
function Field({label,value}){return <div><span>{label}</span><b>{value||"—"}</b></div>}
function RecordForm({patients,selected,setSelected,record,setRecord,onSubmit}){const update=(k,v)=>setRecord(o=>({...o,[k]:v}));return <section className="content narrow-content"><div className="section-head"><div><span className="eyebrow">EVENTO CLÍNICO</span><h2>Registrar atención</h2><p>El registro clínico se cifra y se agrega como bloque.</p></div></div><form className="panel-form" onSubmit={onSubmit}><label>Paciente<select value={selected?.id||""} onChange={e=>setSelected(patients.find(p=>p.id===e.target.value)||null)} required><option value="">Seleccionar paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.id}</option>)}</select></label><label>Tipo de atención<select value={record.category} onChange={e=>update("category",e.target.value)}><option>CONSULTA</option><option>EMERGENCIA</option><option>DIAGNOSTICO</option><option>LABORATORIO</option><option>VACUNA</option><option>SEGUIMIENTO</option></select></label><label>Motivo de consulta<input value={record.motivo_consulta} onChange={e=>update("motivo_consulta",e.target.value)} required/></label><label>Diagnóstico<input value={record.diagnostico} onChange={e=>update("diagnostico",e.target.value)} required/></label><label>Tratamiento<input value={record.tratamiento} onChange={e=>update("tratamiento",e.target.value)} required/></label><label>Signos vitales<input value={record.signos_vitales} onChange={e=>update("signos_vitales",e.target.value)} placeholder="Ej. PA 120/80 · FC 72"/></label><label>Observaciones<input value={record.observaciones} onChange={e=>update("observaciones",e.target.value)} required/></label><button className="primary form-submit">Guardar atención y minar bloque</button></form></section>}
function PatientModal({form,setForm,onSubmit,onClose,loading}){const update=(k,v)=>setForm(o=>({...o,[k]:v}));return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">NUEVO PACIENTE</span><h2>Registrar paciente</h2><p>La ficha se guarda en pacientes.json y no genera un bloque.</p></div><button className="icon-button" onClick={onClose}>×</button></div><form className="patient-form" onSubmit={onSubmit}><div className="form-section-title">Información personal</div><label>Nombre completo<input value={form.nombre} onChange={e=>update("nombre",e.target.value)} required/></label><label>DUI<input value={form.dui} onChange={e=>update("dui",e.target.value)} placeholder="00000000-0" required/></label><label>Fecha de nacimiento<input type="date" value={form.fecha_nacimiento} onChange={e=>update("fecha_nacimiento",e.target.value)} required/></label><label>Tipo de sangre<select value={form.tipo_sangre} onChange={e=>update("tipo_sangre",e.target.value)} required><option value="">Seleccionar</option>{["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(x=><option key={x}>{x}</option>)}</select></label><div className="form-section-title">Información médica</div><label>Alergias<input value={form.alergias} onChange={e=>update("alergias",e.target.value)} placeholder="Ninguna o especificar" required/></label><label>Vacunas<input value={form.vacunas} onChange={e=>update("vacunas",e.target.value)} placeholder="Ninguna o especificar" required/></label><label>Enfermedades crónicas<input value={form.cronicas} onChange={e=>update("cronicas",e.target.value)} placeholder="Ninguna o especificar" required/></label><div className="form-section-title">Información de contacto</div><label>Teléfono<input value={form.telefono} onChange={e=>update("telefono",e.target.value)}/></label><label>Dirección<input value={form.direccion} onChange={e=>update("direccion",e.target.value)}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={loading}>{loading?"Guardando…":"Registrar paciente"}</button></div></form></div></div>}
function Blockchain({chain,blocks,loading,onGenesis,selectedNode}){return <section className="content"><div className="section-head"><div><span className="eyebrow">ADMINISTRACIÓN TÉCNICA</span><h2>Blockchain</h2><p>{selectedNode?`Estado de ${selectedNode}: Genesis, bloques y Proof of Work.`:"Selecciona un nodo activo."}</p></div><span className={chain?.valid?"status ok":"status"}>{chain?.valid?"Cadena válida":"Pendiente"}</span></div><div className="stats"><Stat label="Bloques" value={chain?.blocks??0}/><Stat label="Complejidad" value={chain?.complexity??"—"}/><Stat label="Proof of Work" value={chain?.proof_of_work||"—"}/><Stat label="Estado" value={loading?"…":chain?.valid?"Íntegra":"Pendiente"}/></div><div className="two-col"><div className="panel"><h3>Genesis</h3><p className="muted">Genesis crea únicamente el bloque <b>#0</b>.</p><button className="primary" onClick={onGenesis} disabled={loading||!selectedNode||Boolean(chain?.blocks)}>{loading?"Procesando…":chain?.blocks?"Genesis ya creado":"Crear Genesis"}</button></div><div className="panel"><h3>Bloques almacenados</h3><div className="block-list">{blocks.map(b=><div className="block-row" key={b.hash}><b>Bloque #{b.id}</b><span>{b.hash}</span><div className="block-meta"><small><b>Previous Hash</b>{b.previous_hash||"—"}</small><small><b>Nonce</b>{b.nonce}</small></div></div>)}{!blocks.length&&<div className="empty">No hay bloques.</div>}</div></div></div></section>}
function Network({nodes,form,setForm,loading,onCreate,onStart,onStop,onDelete}){return <section className="content"><div className="section-head"><div><span className="eyebrow">INFRAESTRUCTURA</span><h2>Nodos / Servidores</h2><p>Administra las instancias que mantienen las copias de la Blockchain.</p></div><span className="status ok">{nodes.filter(n=>n.running).length} activos</span></div><div className="network-layout"><div className="node-stack">{nodes.map(n=><article className="node-card" key={n.name}><div className="node-icon" aria-hidden="true">⌁</div><div className="node-main"><span>{n.name}</span><b>IP {n.ip} · Puerto {n.port}</b><small>{n.running?"Servidor escuchando por TCP":"Servidor detenido"}</small></div><strong className={n.running?"node-on":"node-off"}>{n.running?"ACTIVO":"DETENIDO"}</strong><div className="node-actions">{n.running?<button type="button" disabled={loading} onClick={()=>onStop(n.name)}>Detener</button>:<button type="button" disabled={loading} onClick={()=>onStart(n.name)}>Iniciar</button>}{!n.running&&<button type="button" disabled={loading} className="danger-link" onClick={()=>onDelete(n.name)}>Eliminar</button>}</div></article>)}{!nodes.length&&<div className="empty">No hay servidores configurados.</div>}</div><form className="panel node-create" onSubmit={onCreate} aria-busy={loading}><h3>Crear servidor</h3><p>Configura una nueva instancia.</p><label>Nombre<input placeholder="NODO_1" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>IP<input value={form.ip} onChange={e=>setForm({...form,ip:e.target.value})} required/></label><label>Puerto<input type="number" min="1024" max="65535" value={form.port} onChange={e=>setForm({...form,port:e.target.value})} required/></label><button className="primary" disabled={loading}>{loading?"Creando…":"＋ Crear servidor"}</button></form></div></section>}
