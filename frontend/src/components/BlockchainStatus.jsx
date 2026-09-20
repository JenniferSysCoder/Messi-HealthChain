import React from 'react';

export default function BlockchainStatus({ data }) {
  if (!data) return null;
  return <section className="card blockchain-card">
    <div className="section-heading"><div><h2>Estado de Blockchain</h2><p>Información actual de la cadena registrada por el servidor.</p></div><span className={data.valida ? 'status-ok' : 'status-error'}>{data.valida ? 'Válida' : 'Inválida'}</span></div>
    <div className="stats"><div><span>Bloques</span><strong>{data.bloques}</strong></div><div><span>Proof of Work</span><strong>{data.proof_of_work}</strong></div><div><span>Estado</span><strong>{data.valida ? 'Integridad OK' : 'Revisar cadena'}</strong></div></div>
    <div className="block-list">{(data.cadena?.block_chain || []).map((b) => <div className="block-row" key={b.id}><strong>Bloque #{b.id}</strong><span>Nonce: {b.nonce}</span><code>{b.hash}</code></div>)}</div>
  </section>;
}
