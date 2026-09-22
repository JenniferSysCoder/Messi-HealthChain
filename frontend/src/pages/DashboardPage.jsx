import { useEffect, useMemo, useState } from "react";

import {
  createClinicalRecord,
  createGenesis,
  getBlockchainBlocks,
  getBlockchainStatus,
} from "../services/api";

export default function DashboardPage({
  user,
  patients = [],
  selectedPatient,
  history = [],
  loadingHistory,
  error,
  onSelectPatient,
  onBackToPatients,
  onHistoryReload,
  onLogout,
  onPatientsReload,
}) {
  const [activeSection, setActiveSection] = useState(user?.rol === "PACIENTE" ? "history" : "dashboard");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [blockchain, setBlockchain] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [loadingBlockchain, setLoadingBlockchain] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [recordMessage, setRecordMessage] = useState("");
  const [recordError, setRecordError] = useState("");
  const [category, setCategory] = useState("CONSULTA");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [vaccines, setVaccines] = useState("");
  const [chronic, setChronic] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [genesisComplexity, setGenesisComplexity] = useState("");
  const [genesisProofChar, setGenesisProofChar] = useState("");
  const [genesisMessage, setGenesisMessage] = useState("");
  const [genesisError, setGenesisError] = useState("");
  const [creatingGenesis, setCreatingGenesis] = useState(false);

  const professionalName = user?.nombre || user?.username || "Profesional";
  const showPatientsSection = user?.rol !== "PACIENTE";
  const canCreateGenesis = user?.rol === "ADMIN";
  const canReadBlocks = user?.rol === "ADMIN" || user?.rol === "PROFESIONAL";

  useEffect(() => {
    if (selectedPatient && showPatientsSection) {
      setActiveSection("history");
    }
  }, [selectedPatient, showPatientsSection]);

  useEffect(() => {
    if (activeSection === "blockchain") {
      loadBlockchain();
      if (canReadBlocks) {
        loadBlocks();
      }
    }
  }, [activeSection, canReadBlocks]);

  function getRoleName(role) {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "Administrador";
      case "PROFESIONAL":
        return "Profesional de salud";
      case "PACIENTE":
        return "Paciente";
      default:
        return "Usuario";
    }
  }

  function selectSection(section) {
    setActiveSection(section);
    setRecordMessage("");
    setRecordError("");
    setGenesisMessage("");
    setGenesisError("");
    setMobileSidebarOpen(false);

  }

  async function loadBlockchain() {
    try {
      setLoadingBlockchain(true);
      const response = await getBlockchainStatus();
      setBlockchain(response);
    } catch (err) {
      console.error(err);
      setRecordError(err.message);
    } finally {
      setLoadingBlockchain(false);
    }
  }

  async function loadBlocks() {
    try {
      setLoadingBlocks(true);
      const response = await getBlockchainBlocks();
      setBlocks(response?.blocks || []);
    } catch (err) {
      console.error(err);
      setRecordError(err.message);
    } finally {
      setLoadingBlocks(false);
    }
  }

  async function handleCreateRecord(e) {
    e.preventDefault();
    setRecordMessage("");
    setRecordError("");

    if (!selectedPatient) {
      setRecordError("Primero selecciona un paciente.");
      return;
    }

    if (!category.trim() || !bloodType.trim() || !allergies.trim() || !vaccines.trim() || !chronic.trim()) {
      setRecordError("Completa todos los campos clínicos obligatorios.");
      return;
    }

    const clinicalData = {
      nombre: selectedPatient.nombre,
      tipo_sangre: bloodType,
      alergias: allergies,
      vacunas: vaccines,
      cronicas: chronic,
    };

    try {
      const response = await createClinicalRecord({
        paciente_id: selectedPatient.id,
        categoria: category,
        datos: clinicalData,
      });

      if (!response?.success) {
        throw new Error(response?.message || "No fue posible crear el registro.");
      }

      setRecordMessage(response.message || "Registro creado correctamente.");
      setBloodType("");
      setAllergies("");
      setVaccines("");
      setChronic("");
      await onHistoryReload?.();
      setActiveSection("history");
    } catch (err) {
      console.error(err);
      setRecordError(err.message || "No fue posible crear el registro.");
    }
  }

  async function handleCreateGenesis() {
    setGenesisMessage("");
    setGenesisError("");

    if (genesisComplexity === "" || genesisProofChar === "") {
      setGenesisError("Ingresa la complejidad y el carácter de prueba de trabajo.");
      return;
    }

    const parsedComplexity = Number(genesisComplexity);
    if (!Number.isInteger(parsedComplexity) || parsedComplexity < 1 || parsedComplexity > 6) {
      setGenesisError("La complejidad debe ser un número entero entre 1 y 6.");
      return;
    }

    if (genesisProofChar.length !== 1) {
      setGenesisError("El carácter de prueba de trabajo debe ser exactamente un carácter.");
      return;
    }

    setCreatingGenesis(true);

    try {
      const response = await createGenesis(parsedComplexity, genesisProofChar);

      if (!response?.success) {
        throw new Error(response?.message || "No fue posible crear el bloque génesis.");
      }

      setGenesisMessage(response.message || "Bloque génesis creado correctamente.");
      await loadBlockchain();
    } catch (err) {
      console.error(err);
      setGenesisError(err.message || "No fue posible crear el Genesis.");
    } finally {
      setCreatingGenesis(false);
    }
  }

  const filteredPatients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return patients;

    return patients.filter((patient) => {
      const values = [patient?.nombre, patient?.id, patient?.dui].filter(Boolean);
      return values.some((value) => value.toString().toLowerCase().includes(term));
    });
  }, [patients, searchTerm]);

  return (
    <div className="dashboard-app">
      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Abrir menú"
        onClick={() => setMobileSidebarOpen((open) => !open)}
      >
        ☰
      </button>

      {mobileSidebarOpen && (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside className={`dashboard-sidebar ${mobileSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">M</div>
          <div>
            <h1>
              MESSI <strong>HealthChain</strong>
            </h1>
            <span>Gestión clínica segura</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Principal</div>

          {showPatientsSection && (
            <button
              type="button"
              className={`nav-item ${activeSection === "dashboard" ? "active" : ""}`}
              onClick={() => selectSection("dashboard")}
            >
              <span className="nav-icon">⌂</span>
              Dashboard
            </button>
          )}

          {showPatientsSection && (
            <button
              type="button"
              className={`nav-item ${activeSection === "patients" ? "active" : ""}`}
              onClick={() => selectSection("patients")}
            >
              <span className="nav-icon">♙</span>
              Pacientes
            </button>
          )}

          <div className="nav-section-title">Gestión clínica</div>

          <button
            type="button"
            className={`nav-item ${activeSection === "history" ? "active" : ""}`}
            onClick={() => {
              if (selectedPatient || user?.rol === "PACIENTE") {
                selectSection("history");
              } else if (showPatientsSection) {
                selectSection("patients");
              }
            }}
          >
            <span className="nav-icon">▣</span>
            {user?.rol === "PACIENTE" ? "Mi historial" : "Historial clínico"}
          </button>

          {showPatientsSection && (
            <button
              type="button"
              className={`nav-item ${activeSection === "record" ? "active" : ""}`}
              onClick={() => {
                if (selectedPatient) {
                  selectSection("record");
                } else {
                  selectSection("patients");
                }
              }}
            >
              <span className="nav-icon">＋</span>
              Nuevo registro
            </button>
          )}

          <div className="nav-section-title">Blockchain</div>

          <button
            type="button"
            className={`nav-item ${activeSection === "blockchain" ? "active" : ""}`}
            onClick={() => selectSection("blockchain")}
          >
            <span className="nav-icon">⛓</span>
            Blockchain
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security">
            <span>✓</span>
            <div>
              <strong>Sistema seguro</strong>
              <small>Blockchain activo</small>
            </div>
          </div>

          <button type="button" className="logout-button" onClick={onLogout}>
            <span>↪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-breadcrumb">MESSI HealthChain / {activeSection}</p>
            <h2>
              {activeSection === "dashboard"
                ? `Buenos días, ${professionalName}`
                : activeSection === "patients"
                ? "Pacientes"
                : activeSection === "history"
                ? user?.rol === "PACIENTE"
                  ? "Mi historial clínico"
                  : "Historial clínico"
                : activeSection === "record"
                ? "Nuevo registro clínico"
                : "Blockchain"}
            </h2>
            <p className="dashboard-subtitle">
              {activeSection === "dashboard"
                ? "Consulta y gestiona la información de tus pacientes."
                : activeSection === "patients"
                ? "Consulta los pacientes autorizados."
                : activeSection === "history"
                ? "Información clínica registrada en la cadena."
                : activeSection === "record"
                ? "Agrega un nuevo evento clínico al historial."
                : "Estado e integridad de la cadena de bloques."}
            </p>
          </div>

          <div className="header-user">
            <div className="header-user-info">
              <strong>{professionalName}</strong>
              <span>{getRoleName(user?.rol)}</span>
            </div>
            <div className="header-avatar">{professionalName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        {(error || recordError) && (
          <div className="dashboard-error">
            <span>!</span>
            {error || recordError}
          </div>
        )}

        {recordMessage && (
          <div className="dashboard-success">
            <span>✓</span>
            {recordMessage}
          </div>
        )}

        {activeSection === "dashboard" && showPatientsSection && (
          <>
            <section className="dashboard-stats">
              <div className="stat-card">
                <div className="stat-icon blue">♙</div>
                <div>
                  <span>Pacientes registrados</span>
                  <strong>{patients.length}</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green">✓</div>
                <div>
                  <span>Acceso autorizado</span>
                  <strong>Activo</strong>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">⛓</div>
                <div>
                  <span>Blockchain</span>
                  <strong>Operativo</strong>
                </div>
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="panel-header">
                <div>
                  <h3>Pacientes</h3>
                  <p>Selecciona un paciente para consultar su información.</p>
                </div>
                {onPatientsReload && (
                  <button type="button" className="refresh-button" onClick={onPatientsReload}>
                    Actualizar
                  </button>
                )}
              </div>

              <div className="search-box">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, ID o DUI"
                />
              </div>

              {filteredPatients.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">♙</div>
                  <h3>No hay pacientes</h3>
                  <p>No existen pacientes disponibles.</p>
                </div>
              ) : (
                <div className="patients-table">
                  <div className="table-header">
                    <span>Paciente</span>
                    <span>Identificación</span>
                    <span>Estado</span>
                    <span></span>
                  </div>

                  {filteredPatients.map((patient) => (
                    <div
                      className="patient-row"
                      key={patient.id}
                      onClick={() => onSelectPatient(patient)}
                    >
                      <div className="patient-name">
                        <div className="patient-avatar">{patient.nombre?.charAt(0).toUpperCase()}</div>
                        <div>
                          <strong>{patient.nombre}</strong>
                          <span>Paciente</span>
                        </div>
                      </div>

                      <span className="patient-id">{patient.dui || patient.id}</span>

                      <span className="status-badge">
                        <i></i>
                        Registrado
                      </span>

                      <button
                        type="button"
                        className="view-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPatient(patient);
                        }}
                      >
                        Ver historial →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeSection === "patients" && showPatientsSection && (
          <section className="dashboard-panel">
            <div className="panel-header">
              <div>
                <h3>Pacientes</h3>
                <p>Selecciona un paciente para consultar su información.</p>
              </div>
              {onPatientsReload && (
                <button type="button" className="refresh-button" onClick={onPatientsReload}>
                  Actualizar
                </button>
              )}
            </div>

            <div className="search-box">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, ID o DUI"
              />
            </div>

            {filteredPatients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">♙</div>
                <h3>No hay pacientes</h3>
                <p>No existen pacientes disponibles.</p>
              </div>
            ) : (
              <div className="patients-table">
                <div className="table-header">
                  <span>Paciente</span>
                  <span>Identificación</span>
                  <span>Estado</span>
                  <span></span>
                </div>

                {filteredPatients.map((patient) => (
                  <div
                    className="patient-row"
                    key={patient.id}
                    onClick={() => onSelectPatient(patient)}
                  >
                    <div className="patient-name">
                      <div className="patient-avatar">{patient.nombre?.charAt(0).toUpperCase()}</div>
                      <div>
                        <strong>{patient.nombre}</strong>
                        <span>Paciente</span>
                      </div>
                    </div>

                    <span className="patient-id">{patient.dui || patient.id}</span>

                    <span className="status-badge">
                      <i></i>
                      Registrado
                    </span>

                    <button
                      type="button"
                      className="view-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPatient(patient);
                      }}
                    >
                      Ver historial →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === "history" && (
          <>
            {!selectedPatient ? (
              <div className="empty-state">
                <div className="empty-icon">♙</div>
                <h3>{user?.rol === "PACIENTE" ? "Tu historial" : "Selecciona un paciente"}</h3>
                <p>
                  {user?.rol === "PACIENTE"
                    ? "Aún no tienes un paciente asociado para consultar."
                    : "Ve a Pacientes para consultar un historial clínico."}
                </p>
              </div>
            ) : (
              <>
                {showPatientsSection && (
                  <button
                    type="button"
                    className="back-button"
                    onClick={() => {
                      onBackToPatients();
                      setActiveSection("patients");
                    }}
                  >
                    ← Volver a pacientes
                  </button>
                )}

                {user?.rol === "PROFESIONAL" && (
                  <button
                    type="button"
                    className="new-record-button"
                    onClick={() => {
                      setRecordError("");
                      setRecordMessage("");
                      setActiveSection("record");
                    }}
                  >
                    Nuevo registro para este paciente
                  </button>
                )}

                <div className="patient-profile-card">
                  <div className="large-patient-avatar">{selectedPatient.nombre?.charAt(0).toUpperCase()}</div>
                  <div className="patient-profile-info">
                    <span>PACIENTE</span>
                    <h3>{selectedPatient.nombre}</h3>
                    <p>ID: {selectedPatient.id}</p>
                  </div>
                  <div className="patient-chain-status">
                    <span>✓</span>
                    <div>
                      <strong>Historial protegido</strong>
                      <small>Blockchain</small>
                    </div>
                  </div>
                </div>

                <div className="history-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Historial clínico</h3>
                      <p>Eventos registrados en Blockchain.</p>
                    </div>
                    <div className="history-count">{history.length} registros</div>
                  </div>

                  {loadingHistory ? (
                    <div className="loading-state">
                      <div className="loading-spinner"></div>
                      Consultando historial...
                    </div>
                  ) : history.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">▣</div>
                      <h3>Sin registros clínicos</h3>
                      <p>Este paciente todavía no tiene eventos registrados.</p>
                    </div>
                  ) : (
                    <div className="timeline">
                      {history.map((record, index) => (
                        <div className="timeline-item" key={record.id || index}>
                          <div className="timeline-marker">✓</div>
                          <div className="timeline-content">
                            <div className="timeline-top">
                              <div>
                                <span className="timeline-category">{record.categoria}</span>
                                <h4>Registro clínico</h4>
                              </div>
                              <span className="timeline-date">
                                {record.timestamp ? new Date(record.timestamp).toLocaleDateString() : "—"}
                              </span>
                            </div>

                            <p>
                              Emitido por <strong>{record.entidad_emisora}</strong>
                            </p>

                            {record.datos && (
                              <div className="clinical-data">
                                <div>
                                  <span>Sangre</span>
                                  <strong>{record.datos.tipo_sangre || "—"}</strong>
                                </div>
                                <div>
                                  <span>Alergias</span>
                                  <strong>{record.datos.alergias || "—"}</strong>
                                </div>
                                <div>
                                  <span>Vacunas</span>
                                  <strong>{record.datos.vacunas || "—"}</strong>
                                </div>
                                <div>
                                  <span>Crónicas</span>
                                  <strong>{record.datos.cronicas || "—"}</strong>
                                </div>
                              </div>
                            )}

                            <div className="blockchain-record">⛓ Registro almacenado en Blockchain</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {activeSection === "record" && showPatientsSection && selectedPatient && (
          <div className="record-panel">
            <div className="record-patient">
              <div className="large-patient-avatar">{selectedPatient.nombre?.charAt(0).toUpperCase()}</div>
              <div>
                <span>PACIENTE</span>
                <h3>{selectedPatient.nombre}</h3>
                <p>ID: {selectedPatient.id}</p>
              </div>
            </div>

            <form className="record-form" onSubmit={handleCreateRecord}>
              <div className="record-field">
                <label>Categoría</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="CONSULTA">Consulta</option>
                  <option value="EMERGENCIA">Emergencia</option>
                  <option value="VACUNA">Vacuna</option>
                  <option value="LABORATORIO">Laboratorio</option>
                  <option value="DIAGNOSTICO">Diagnóstico</option>
                </select>
              </div>

              <div className="record-field">
                <label>Tipo de sangre</label>
                <input required value={bloodType} onChange={(e) => setBloodType(e.target.value)} placeholder="Ej. O+" />
              </div>

              <div className="record-field">
                <label>Alergias</label>
                <input required value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ej. Penicilina" />
              </div>

              <div className="record-field">
                <label>Vacunas</label>
                <input required value={vaccines} onChange={(e) => setVaccines(e.target.value)} placeholder="Ej. COVID-19" />
              </div>

              <div className="record-field">
                <label>Enfermedades crónicas</label>
                <input required value={chronic} onChange={(e) => setChronic(e.target.value)} placeholder="Ej. Asma" />
              </div>

              <div className="record-security">
                <span>🔐</span>
                <div>
                  <strong>Información protegida</strong>
                  <p>Los datos clínicos serán cifrados antes de almacenarse en el Blockchain.</p>
                </div>
              </div>

              <div className="record-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setActiveSection("history")}
                >
                  Cancelar
                </button>
                <button type="submit" className="record-submit">Crear y minar registro</button>
              </div>
            </form>
          </div>
        )}

        {activeSection === "blockchain" && (
          <div className="blockchain-page">
            {loadingBlockchain ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                Consultando Blockchain...
              </div>
            ) : blockchain ? (
              <>
                <div className="blockchain-status-card">
                  <div>
                    <span>ESTADO DE LA CADENA</span>
                    <h3>{blockchain.valid ? "Blockchain válida" : "Blockchain inválida"}</h3>
                    <p>{blockchain.message}</p>
                  </div>
                  <div className={blockchain.valid ? "chain-valid" : "chain-invalid"}>
                    {blockchain.valid ? "✓ Válida" : "! Error"}
                  </div>
                </div>

                <div className="blockchain-stats">
                  <div className="block-stat">
                    <span>BLOQUES</span>
                    <strong>{blockchain.blocks}</strong>
                  </div>
                  <div className="block-stat">
                    <span>REGISTROS</span>
                    <strong>
                      {blockchain.records ??
                        blocks.reduce(
                          (total, block) => total + (block.a_registros?.length || 0),
                          0,
                        )}
                    </strong>
                  </div>
                  <div className="block-stat">
                    <span>DIFICULTAD</span>
                    <strong>{blockchain.complexity}</strong>
                  </div>
                  <div className="block-stat">
                    <span>PRUEBA</span>
                    <strong>{blockchain.proof_of_work}</strong>
                  </div>
                </div>

                  {canCreateGenesis && (
                  <div className="dashboard-panel">
                  <div className="panel-header">
                    <div>
                      <h3>Bloque génesis</h3>
                      <p>Inicialización y validación de la cadena.</p>
                    </div>
                  </div>

                  <div className="genesis-panel">
                    <div className="genesis-controls">
                      <label>
                        Complejidad
                        <input
                          type="number"
                          name="genesis-complexity"
                          min="1"
                          max="6"
                          step="1"
                          required
                          value={genesisComplexity}
                          onChange={(e) => setGenesisComplexity(e.target.value)}
                        />
                      </label>

                      <label>
                        Carácter de prueba
                        <input
                          type="text"
                          name="genesis-proof-char"
                          maxLength="1"
                          required
                          value={genesisProofChar}
                          onChange={(e) => setGenesisProofChar(e.target.value)}
                        />
                      </label>
                    </div>

                    <button type="button" className="record-submit" onClick={handleCreateGenesis} disabled={creatingGenesis}>
                      {creatingGenesis ? "Creando Genesis..." : "Crear bloque génesis"}
                    </button>

                    {genesisMessage && <div className="dashboard-success compact">{genesisMessage}</div>}
                    {genesisError && <div className="dashboard-error compact">{genesisError}</div>}
                  </div>

                  {blockchain.last_hash && <div className="hash-display">{blockchain.last_hash}</div>}
                  </div>
                  )}

                  {canReadBlocks && (
                    <div className="dashboard-panel">
                      <div className="panel-header">
                        <div>
                          <h3>Bloques registrados</h3>
                          <p>Contenido persistido y validado por la cadena.</p>
                        </div>
                        <button type="button" className="refresh-button" onClick={loadBlocks} disabled={loadingBlocks}>
                          {loadingBlocks ? "Consultando..." : "Actualizar"}
                        </button>
                      </div>

                      {loadingBlocks ? (
                        <div className="loading-state">Consultando bloques...</div>
                      ) : blocks.length === 0 ? (
                        <div className="empty-state">
                          <h3>No hay bloques registrados</h3>
                          <p>La cadena todavía no contiene bloques.</p>
                        </div>
                      ) : (
                        <div className="blocks-list">
                          {blocks.map((block) => (
                            <div className="block-row" key={block.id}>
                              <strong>Bloque #{block.id}</strong>
                              <span>{block.a_registros?.length || 0} registros</span>
                              <code>{block.hash || "Sin hash"}</code>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </>
            ) : (
              <div className="empty-state">
                <h3>No se pudo consultar la cadena</h3>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
