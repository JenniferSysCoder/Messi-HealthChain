import React, { useEffect, useState } from 'react';

const initial = { categoria: 'CONSULTA', nombre: '', tipo_sangre: '', alergias: '', vacunas: '', cronicas: '' };

export default function ClinicalRecordForm({ patient, onSave, busy }) {
  const [form, setForm] = useState({ ...initial, nombre: patient?.nombre || '', tipo_sangre: patient?.tipo_sangre || '' });
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({ ...initial, nombre: patient?.nombre || '', tipo_sangre: patient?.tipo_sangre || '' });
    setError('');
  }, [patient]);

  const update = (field, value) => setForm((old) => ({ ...old, [field]: value }));
  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!patient?.id) {
      setError('Selecciona un paciente antes de crear el registro.');
      return;
    }

    const clinicalData = {
      nombre: patient.nombre,
      tipo_sangre: form.tipo_sangre.trim(),
      alergias: form.alergias.trim(),
      vacunas: form.vacunas.trim(),
      cronicas: form.cronicas.trim(),
    };

    if (Object.values(clinicalData).some((value) => !value)) {
      setError('Completa todos los campos clínicos obligatorios.');
      return;
    }

    try {
      await onSave(patient.id, form.categoria, clinicalData);
      setForm({ ...initial, nombre: patient.nombre, tipo_sangre: patient.tipo_sangre || '' });
    } catch (saveError) {
      setError(saveError.message || 'No fue posible crear el registro.');
    }
  };

  return <form className="card form-card" onSubmit={submit}>
    <div className="section-heading"><div><h2>Nuevo registro clínico</h2><p>El evento será cifrado y agregado a un nuevo bloque.</p></div></div>
    <p>Paciente seleccionado: <strong>{patient?.nombre || 'Ninguno'} ({patient?.id || 'sin ID'})</strong></p>
    <label>Categoría<select value={form.categoria} onChange={(e) => update('categoria', e.target.value)}><option value="CONSULTA">Consulta</option><option value="EMERGENCIA">Emergencia</option><option value="LABORATORIO">Laboratorio</option><option value="DIAGNOSTICO">Diagnóstico</option><option value="SEGUIMIENTO">Seguimiento</option></select></label>
    <label>Nombre del paciente<input value={form.nombre} readOnly /></label>
    <div className="form-grid"><label>Tipo de sangre<input required value={form.tipo_sangre} onChange={(e) => update('tipo_sangre', e.target.value)} /></label><label>Alergias<input required value={form.alergias} onChange={(e) => update('alergias', e.target.value)} /></label></div>
    <label>Enfermedades crónicas<input required value={form.cronicas} onChange={(e) => update('cronicas', e.target.value)} /></label>
    <label>Vacunas<input required value={form.vacunas} onChange={(e) => update('vacunas', e.target.value)} /></label>
    {error && <div className="error-box">{error}</div>}
    <button className="primary" disabled={busy}>{busy ? 'Minando bloque…' : 'Guardar y minar bloque'}</button>
  </form>;
}
