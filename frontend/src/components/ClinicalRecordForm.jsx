import React, { useState } from 'react';

const initial = { categoria: 'Consulta general', nombre: '', tipo_sangre: 'O+', alergias: 'Ninguna', vacunas: 'Esquema completo', enfermedades_cronicas: 'Ninguna' };

export default function ClinicalRecordForm({ patient, onSave, busy }) {
  const [form, setForm] = useState({ ...initial, nombre: patient.nombre, tipo_sangre: patient.tipo_sangre });
  const update = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const submit = async (e) => { e.preventDefault(); await onSave(form.categoria, { nombre: form.nombre, tipo_sangre: form.tipo_sangre, alergias: form.alergias, vacunas: form.vacunas, enfermedades_cronicas: form.enfermedades_cronicas }); setForm({ ...initial, nombre: patient.nombre, tipo_sangre: patient.tipo_sangre }); };
  return <form className="card form-card" onSubmit={submit}>
    <div className="section-heading"><div><h2>Nuevo registro clínico</h2><p>El evento será cifrado y agregado a un nuevo bloque.</p></div></div>
    <label>Categoría<select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}><option>Consulta general</option><option>Emergencia</option><option>Laboratorio</option><option>Diagnóstico</option><option>Seguimiento</option></select></label>
    <label>Nombre del paciente<input value={form.nombre} onChange={(e) => update('nombre', e.target.value)} /></label>
    <div className="form-grid"><label>Tipo de sangre<select value={form.tipo_sangre} onChange={(e) => update('tipo_sangre', e.target.value)}>{['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(x => <option key={x}>{x}</option>)}</select></label><label>Alergias<input value={form.alergias} onChange={(e) => update('alergias', e.target.value)} /></label></div>
    <label>Enfermedades crónicas<input value={form.enfermedades_cronicas} onChange={(e) => update('enfermedades_cronicas', e.target.value)} /></label>
    <label>Vacunas<input value={form.vacunas} onChange={(e) => update('vacunas', e.target.value)} /></label>
    <button className="primary" disabled={busy}>{busy ? 'Minando bloque…' : 'Guardar y minar bloque'}</button>
  </form>;
}
