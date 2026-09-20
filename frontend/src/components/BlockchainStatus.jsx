export default function BlockchainStatus({ data }) {
  if (!data) {
    return null;
  }

  return (
    <section className="card blockchain-card">
      <div className="section-heading">
        <div>
          <h2>Estado de Blockchain</h2>
          <p>Información actual de la cadena registrada por el servidor.</p>
        </div>
        <span className={data.valid ? "status-ok" : "status-error"}>
          {data.valid ? "Válida" : "Inválida"}
        </span>
      </div>

      <div className="stats">
        <div>
          <span>Bloques</span>
          <strong>{data.blocks}</strong>
        </div>
        <div>
          <span>Proof of Work</span>
          <strong>{data.proof_of_work}</strong>
        </div>
        <div>
          <span>Estado</span>
          <strong>{data.initialized ? "Integridad OK" : "No inicializada"}</strong>
        </div>
      </div>

      {data.genesis && (
        <div className="block-list">
          <div className="block-row" key={data.genesis.id}>
            <strong>Bloque #{data.genesis.id}</strong>
            <span>Nonce: {data.genesis.nonce}</span>
            <code>{data.genesis.hash}</code>
          </div>
        </div>
      )}
    </section>
  );
}
