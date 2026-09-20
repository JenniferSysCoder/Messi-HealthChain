import React from "react";

export default function HistoryTimeline({
  patient,
  history = [],
  onBack,
}) {

  const registros = Array.isArray(history)
    ? history
    : Array.isArray(history?.historial)
      ? history.historial
      : [];

  return (
    <section className="history-section">

      <button
        className="back-button"
        type="button"
        onClick={onBack}
      >
        ← Volver a pacientes
      </button>

      <div className="patient-profile-card">

        <div className="large-avatar">
          {(patient?.nombre || "P")
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <span className="profile-label">
            HISTORIAL CLÍNICO
          </span>

          <h1>
            {patient?.nombre || "Paciente"}
          </h1>

          <p>
            DUI: {patient?.dui || "No disponible"}
          </p>

          <p>
            Tipo de sangre:{" "}
            <strong>
              {patient?.tipo_sangre || "No registrado"}
            </strong>
          </p>
        </div>

      </div>

      <div className="history-header">
        <div>
          <h2>Historial clínico</h2>

          <p>
            Registros almacenados mediante HealthChain.
          </p>
        </div>

        <span className="blockchain-badge">
          ● Blockchain
        </span>
      </div>

      {registros.length === 0 ? (

        <div className="empty-history">

          <h3>No existen registros clínicos</h3>

          <p>
            Este paciente todavía no tiene eventos registrados
            en la cadena.
          </p>

        </div>

      ) : (

        <div className="timeline">

          {registros.map((registro, index) => (

            <div
              className="timeline-item"
              key={registro.id || index}
            >

              <div className="timeline-dot">
                {index + 1}
              </div>

              <div className="timeline-card">

                <div className="timeline-top">

                  <div>
                    <span className="record-category">
                      {registro.categoria || "Registro clínico"}
                    </span>

                    <h3>
                      {registro.entidad_emisora ||
                        "Entidad emisora"}
                    </h3>
                  </div>

                  <span className="record-date">
                    {registro.timestamp || ""}
                  </span>

                </div>

                <div className="record-details">

                  <div>
                    <span>Paciente</span>
                    <strong>
                      {registro.paciente_id || patient?.id}
                    </strong>
                  </div>

                  <div>
                    <span>Bloque</span>
                    <strong>
                      {registro.block_id ?? "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong className="valid-status">
                      ✓ Verificado
                    </strong>
                  </div>

                </div>

              </div>

            </div>

          ))}

        </div>

      )}

    </section>
  );
}