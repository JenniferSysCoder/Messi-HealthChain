import React from 'react';

export default function HistoryTimeline({ records }) {
  if (!records.length) return <div className="empty">Este paciente todavía no tiene eventos clínicos registrados.</div>;
  return <div className="timeline">
    {records.map((record, index) => (
      <article className="timeline-item" key={`${record.id}-${index}`}>
        <div className="timeline-dot" />
        <div className="timeline-content">
          <div className="timeline-top"><div><strong>{record.categoria}</strong><span>{record.entidad_emisora}</span></div><time>{record.timestamp}</time></div>
          <div className="clinical-data">
            <div><label>Tipo de sangre</label><strong>{record.datos?.tipo_sangre || '—'}</strong></div>
            <div><label>Alergias</label><strong>{record.datos?.alergias || '—'}</strong></div>
            <div><label>Enfermedades crónicas</label><strong>{record.datos?.enfermedades_cronicas || '—'}</strong></div>
            <div><label>Vacunas</label><strong>{record.datos?.vacunas || '—'}</strong></div>
          </div>
          <small>Registro protegido y almacenado mediante Blockchain</small>
        </div>
      </article>
    ))}
  </div>;
}
