import React, { useState } from "react";

export default function BlockchainStatus({ data }) {
  const bloque = data.bloqueSeleccionado || data; 
  
  const [mostrarJSON, setMostrarJSON] = useState(false);

  if (!bloque) return <p>No hay datos del bloque disponibles.</p>;

  return (
    <div className="blockchain-status-modal">
      <div className="modal-header">
        <span className="subtitle">DETALLE DE BLOCKCHAIN</span>
        <button className="close-btn">X</button>
      </div>

      <h2>Bloque #{bloque.index}</h2>
      <p className="text-muted">Información del bloque seleccionado.</p>

      <div className="bloque-hashes">
        <h4>Hash</h4>
        <p className="hash-text">{bloque.hash}</p>
        
        <h4>Previous Hash</h4>
        <p className="hash-text">{bloque.previous_hash}</p>
      </div>

      <div className="bloque-grid">
        <div className="grid-item">
          <span className="label">ID DEL BLOQUE</span>
          <span className="value">{bloque.index}</span>
        </div>
        <div className="grid-item">
          <span className="label">NONCE</span>
          <span className="value">{bloque.nonce}</span>
        </div>
        <div className="grid-item">
          <span className="label">PRUEBA DE TRABAJO</span>
          <span className="value">Válida · prefijo 0000</span>
        </div>
        <div className="grid-item">
          <span className="label">FECHA</span>
          <span className="value">{new Date(parseInt(bloque.timestamp)).toLocaleString()}</span>
        </div>
        <div className="grid-item">
          <span className="label">TIMESTAMP (MS)</span>
          <span className="value">{bloque.timestamp}</span>
        </div>
        <div className="grid-item">
          <span className="label">REGISTROS</span>
          <span className="value">{bloque.registros ? bloque.registros.length : 0}</span>
        </div>
      </div>

      <div className="registros-section">
        <h3>Registros incluidos</h3>
        <div className="registros-card">
          {bloque.registros && bloque.registros.map((registro, idx) => (
            <div key={idx} className="registro-item">
              <p><b>Registro #{idx}</b></p>
              <p><b>Paciente:</b> {registro.paciente || registro.paciente_id}</p>
              <p><b>Categoría:</b> {registro.categoria}</p>
              <p><b>Entidad emisora:</b> {registro.entidad_emisora}</p>
              
              <p><b>Fecha:</b> {new Date(parseInt(registro.fecha || registro.timestamp)).toLocaleString()}</p>
              
              <p><b>Datos clínicos cifrados (no descifrados):</b></p>
              <p className="cifrado-text">{registro.datos_cifrados}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="json-toggle">
        <button onClick={() => setMostrarJSON(!mostrarJSON)} className="btn-link">
          {mostrarJSON ? "▼ Ocultar JSON" : "▶ Ver JSON completo"}
        </button>
        {mostrarJSON && (
          <pre className="json-preview">{JSON.stringify(bloque, null, 2)}</pre>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn-primary">Cerrar</button>
      </div>
    </div>
  );
}