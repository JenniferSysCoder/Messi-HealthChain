import React, {
  useState
} from "react";

import {
  createClinicalRecord,
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

  onLogout,

}) {

  const [
    activeSection,
    setActiveSection
  ] = useState(
    selectedPatient
      ? "history"
      : "dashboard"
  );


  const [
    blockchain,
    setBlockchain
  ] = useState(null);


  const [
    loadingBlockchain,
    setLoadingBlockchain
  ] = useState(false);


  const [
    recordMessage,
    setRecordMessage
  ] = useState("");


  const [
    recordError,
    setRecordError
  ] = useState("");


  const [
    category,
    setCategory
  ] = useState("CONSULTA");


  const [
    bloodType,
    setBloodType
  ] = useState("");


  const [
    allergies,
    setAllergies
  ] = useState("");


  const [
    vaccines,
    setVaccines
  ] = useState("");


  const [
    chronic,
    setChronic
  ] = useState("");


  const professionalName =
    user?.nombre ||
    user?.username ||
    "Profesional";


  function getRoleName(role) {

    switch (
      role?.toUpperCase()
    ) {

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


  function selectSection(
    section
  ) {

    setActiveSection(
      section
    );

    setRecordMessage("");

    setRecordError("");


    if (
      section === "blockchain"
    ) {

      loadBlockchain();
    }
  }


  async function loadBlockchain() {

    const token =
      localStorage.getItem(
        "healthchain_token"
      );

    try {

      setLoadingBlockchain(
        true
      );

      const response =
        await getBlockchainStatus();

      setBlockchain(
        response.blockchain
      );

    } catch (err) {

      console.error(err);

      setRecordError(
        err.message
      );

    } finally {

      setLoadingBlockchain(
        false
      );
    }
  }


  async function handleCreateRecord(
    e
  ) {

    e.preventDefault();

    setRecordMessage("");

    setRecordError("");


    if (!selectedPatient) {

      setRecordError(
        "Primero selecciona un paciente."
      );

      return;
    }


    const token =
      localStorage.getItem(
        "healthchain_token"
      );


    const clinicalData = {

      nombre:
        selectedPatient.nombre,

      tipo_sangre:
        bloodType,

      alergias:
        allergies,

      vacunas:
        vaccines,

      cronicas:
        chronic,
    };


    try {

      const response =
        await createClinicalRecord(
          {
            paciente_id:
              selectedPatient.id,

            categoria:
              category,

            datos:
              clinicalData,
          }
        );


      setRecordMessage(
        response.message ||
        "Registro creado correctamente."
      );


      setBloodType("");
      setAllergies("");
      setVaccines("");
      setChronic("");

      setActiveSection(
        "history"
      );

    } catch (err) {

      console.error(err);

      setRecordError(
        err.message ||
        "No fue posible crear el registro."
      );
    }
  }


  return (

    <div className="dashboard">

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside className="dashboard-sidebar">

        <div className="sidebar-brand">

          <div className="sidebar-logo">
            M
          </div>

          <div>

            <h1>
              MESSI{" "}
              <strong>
                HealthChain
              </strong>
            </h1>

            <span>
              Gestión clínica segura
            </span>

          </div>

        </div>


        <nav className="sidebar-nav">

          <div className="nav-section-title">
            PRINCIPAL
          </div>


          <button
            className={
              `nav-item ${
                activeSection === "dashboard"
                  ? "active"
                  : ""
              }`
            }

            onClick={() =>
              selectSection(
                "dashboard"
              )
            }
          >
            <span className="nav-icon">
              ⌂
            </span>

            Dashboard
          </button>


          <button
            className={
              `nav-item ${
                activeSection === "patients"
                  ? "active"
                  : ""
              }`
            }

            onClick={() =>
              selectSection(
                "patients"
              )
            }
          >
            <span className="nav-icon">
              ♙
            </span>

            Pacientes
          </button>


          <div className="nav-section-title">
            GESTIÓN CLÍNICA
          </div>


          <button
            className={
              `nav-item ${
                activeSection === "history"
                  ? "active"
                  : ""
              }`
            }

            onClick={() =>
              selectedPatient
                ? selectSection("history")
                : selectSection("patients")
            }
          >
            <span className="nav-icon">
              ▣
            </span>

            Historial clínico
          </button>


          <button
            className={
              `nav-item ${
                activeSection === "record"
                  ? "active"
                  : ""
              }`
            }

            onClick={() =>
              selectedPatient
                ? selectSection("record")
                : selectSection("patients")
            }
          >
            <span className="nav-icon">
              +
            </span>

            Nuevo registro
          </button>


          <div className="nav-section-title">
            BLOCKCHAIN
          </div>


          <button
            className={
              `nav-item ${
                activeSection === "blockchain"
                  ? "active"
                  : ""
              }`
            }

            onClick={() =>
              selectSection(
                "blockchain"
              )
            }
          >
            <span className="nav-icon">
              ⛓
            </span>

            Blockchain
          </button>

        </nav>


        <div className="sidebar-bottom">

          <div className="sidebar-security">

            <span>
              ✓
            </span>

            <div>

              <strong>
                Sistema seguro
              </strong>

              <small>
                Blockchain activo
              </small>

            </div>

          </div>


          <button
            className="logout-button"
            onClick={onLogout}
          >
            <span>
              ↪
            </span>

            Cerrar sesión
          </button>

        </div>

      </aside>


      {/* =================================================
          MAIN
      ================================================= */}

      <main className="dashboard-main">

        <header className="dashboard-header">

          <div>

            <p className="dashboard-breadcrumb">
              MESSI HealthChain /{" "}
              {activeSection}
            </p>

            <h2>
              {activeSection === "dashboard"
                ? `Buenos días, ${professionalName}`
                : activeSection === "patients"
                ? "Pacientes"
                : activeSection === "history"
                ? "Historial clínico"
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

              <strong>
                {professionalName}
              </strong>

              <span>
                {getRoleName(
                  user?.rol
                )}
              </span>

            </div>


            <div className="header-avatar">

              {professionalName
                .charAt(0)
                .toUpperCase()}

            </div>

          </div>

        </header>


        {(error ||
          recordError) && (

          <div className="dashboard-error">

            <span>!</span>

            {error ||
              recordError}

          </div>

        )}


        {recordMessage && (

          <div className="dashboard-success">

            <span>✓</span>

            {recordMessage}

          </div>

        )}


        {/* =================================================
            DASHBOARD
        ================================================= */}

        {activeSection === "dashboard" && (

          <>

            <section className="dashboard-stats">

              <div className="stat-card">

                <div className="stat-icon blue">
                  ♙
                </div>

                <div>

                  <span>
                    Pacientes registrados
                  </span>

                  <strong>
                    {patients.length}
                  </strong>

                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon green">
                  ✓
                </div>

                <div>

                  <span>
                    Acceso autorizado
                  </span>

                  <strong>
                    Activo
                  </strong>

                </div>

              </div>


              <div className="stat-card">

                <div className="stat-icon purple">
                  ⛓
                </div>

                <div>

                  <span>
                    Blockchain
                  </span>

                  <strong>
                    Operativo
                  </strong>

                </div>

              </div>

            </section>


            <PatientTable
              patients={patients}
              onSelectPatient={(patient) => {

                onSelectPatient(
                  patient
                );

                setActiveSection(
                  "history"
                );

              }}
            />

          </>

        )}


        {/* =================================================
            PACIENTES
        ================================================= */}

        {activeSection === "patients" && (

          <PatientTable
            patients={patients}
            onSelectPatient={(patient) => {

              onSelectPatient(
                patient
              );

              setActiveSection(
                "history"
              );

            }}
          />

        )}


        {/* =================================================
            HISTORIAL
        ================================================= */}

        {activeSection === "history" && (

          <>

            {!selectedPatient ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ♙
                </div>

                <h3>
                  Selecciona un paciente
                </h3>

                <p>
                  Ve a Pacientes para consultar
                  un historial clínico.
                </p>

              </div>

            ) : (

              <>

                <button
                  className="back-button"
                  onClick={() => {

                    onBackToPatients();

                    setActiveSection(
                      "patients"
                    );

                  }}
                >
                  ← Volver a pacientes
                </button>


                <div className="patient-profile-card">

                  <div className="large-patient-avatar">

                    {selectedPatient.nombre
                      ?.charAt(0)
                      .toUpperCase()}

                  </div>


                  <div className="patient-profile-info">

                    <span>
                      PACIENTE
                    </span>

                    <h3>
                      {selectedPatient.nombre}
                    </h3>

                    <p>
                      ID:{" "}
                      {selectedPatient.id}
                    </p>

                  </div>


                  <div className="patient-chain-status">

                    <span>
                      ✓
                    </span>

                    <div>

                      <strong>
                        Historial protegido
                      </strong>

                      <small>
                        Blockchain
                      </small>

                    </div>

                  </div>

                </div>


                <div className="history-panel">

                  <div className="panel-header">

                    <div>

                      <h3>
                        Historial clínico
                      </h3>

                      <p>
                        Eventos registrados en Blockchain.
                      </p>

                    </div>

                    <div className="history-count">
                      {history.length} registros
                    </div>

                  </div>


                  {loadingHistory ? (

                    <div className="loading-state">

                      <div className="loading-spinner"></div>

                      Consultando historial...

                    </div>

                  ) : history.length === 0 ? (

                    <div className="empty-state">

                      <div className="empty-icon">
                        ▣
                      </div>

                      <h3>
                        Sin registros clínicos
                      </h3>

                      <p>
                        Este paciente todavía
                        no tiene eventos registrados.
                      </p>

                    </div>

                  ) : (

                    <div className="timeline">

                      {history.map(
                        (
                          record,
                          index
                        ) => (

                          <div
                            className="timeline-item"
                            key={
                              record.id ||
                              index
                            }
                          >

                            <div className="timeline-marker">
                              ✓
                            </div>


                            <div className="timeline-content">

                              <div className="timeline-top">

                                <div>

                                  <span className="timeline-category">
                                    {record.categoria}
                                  </span>

                                  <h4>
                                    Registro clínico
                                  </h4>

                                </div>

                                <span className="timeline-date">

                                  {record.timestamp
                                    ? new Date(
                                        record.timestamp
                                      ).toLocaleDateString()
                                    : "—"}

                                </span>

                              </div>


                              <p>
                                Emitido por{" "}
                                <strong>
                                  {
                                    record.entidad_emisora
                                  }
                                </strong>
                              </p>


                              {record.datos && (

                                <div className="clinical-data">

                                  <div>
                                    <span>
                                      Sangre
                                    </span>

                                    <strong>
                                      {
                                        record.datos
                                          .tipo_sangre ||
                                        "—"
                                      }
                                    </strong>
                                  </div>


                                  <div>
                                    <span>
                                      Alergias
                                    </span>

                                    <strong>
                                      {
                                        record.datos
                                          .alergias ||
                                        "—"
                                      }
                                    </strong>
                                  </div>


                                  <div>
                                    <span>
                                      Vacunas
                                    </span>

                                    <strong>
                                      {
                                        record.datos
                                          .vacunas ||
                                        "—"
                                      }
                                    </strong>
                                  </div>


                                  <div>
                                    <span>
                                      Crónicas
                                    </span>

                                    <strong>
                                      {
                                        record.datos
                                          .cronicas ||
                                        "—"
                                      }
                                    </strong>
                                  </div>

                                </div>

                              )}


                              <div className="blockchain-record">

                                ⛓

                                Registro almacenado
                                en Blockchain

                              </div>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  )}

                </div>

              </>

            )}

          </>

        )}


        {/* =================================================
            NUEVO REGISTRO
        ================================================= */}

        {activeSection === "record" && (

          <>

            {!selectedPatient ? (

              <div className="empty-state">

                <div className="empty-icon">
                  ♙
                </div>

                <h3>
                  Selecciona un paciente
                </h3>

                <p>
                  Debes seleccionar un paciente
                  antes de crear un registro.
                </p>

                <button
                  className="back-button"
                  onClick={() =>
                    setActiveSection(
                      "patients"
                    )
                  }
                >
                  Ir a pacientes →
                </button>

              </div>

            ) : (

              <div className="record-panel">

                <div className="record-patient">

                  <div className="large-patient-avatar">

                    {selectedPatient.nombre
                      ?.charAt(0)
                      .toUpperCase()}

                  </div>

                  <div>

                    <span>
                      PACIENTE
                    </span>

                    <h3>
                      {selectedPatient.nombre}
                    </h3>

                    <p>
                      ID: {selectedPatient.id}
                    </p>

                  </div>

                </div>


                <form
                  className="record-form"
                  onSubmit={
                    handleCreateRecord
                  }
                >

                  <div className="record-field">

                    <label>
                      Categoría
                    </label>

                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(
                          e.target.value
                        )
                      }
                    >

                      <option value="CONSULTA">
                        Consulta
                      </option>

                      <option value="EMERGENCIA">
                        Emergencia
                      </option>

                      <option value="VACUNA">
                        Vacuna
                      </option>

                      <option value="LABORATORIO">
                        Laboratorio
                      </option>

                      <option value="DIAGNOSTICO">
                        Diagnóstico
                      </option>

                    </select>

                  </div>


                  <div className="record-field">

                    <label>
                      Tipo de sangre
                    </label>

                    <input
                      value={bloodType}
                      onChange={(e) =>
                        setBloodType(
                          e.target.value
                        )
                      }
                      placeholder="Ej. O+"
                    />

                  </div>


                  <div className="record-field">

                    <label>
                      Alergias
                    </label>

                    <input
                      value={allergies}
                      onChange={(e) =>
                        setAllergies(
                          e.target.value
                        )
                      }
                      placeholder="Ej. Penicilina"
                    />

                  </div>


                  <div className="record-field">

                    <label>
                      Vacunas
                    </label>

                    <input
                      value={vaccines}
                      onChange={(e) =>
                        setVaccines(
                          e.target.value
                        )
                      }
                      placeholder="Ej. COVID-19"
                    />

                  </div>


                  <div className="record-field">

                    <label>
                      Enfermedades crónicas
                    </label>

                    <input
                      value={chronic}
                      onChange={(e) =>
                        setChronic(
                          e.target.value
                        )
                      }
                      placeholder="Ej. Asma"
                    />

                  </div>


                  <div className="record-security">

                    <span>
                      🔐
                    </span>

                    <div>

                      <strong>
                        Información protegida
                      </strong>

                      <p>
                        Los datos clínicos serán
                        cifrados antes de almacenarse
                        en el Blockchain.
                      </p>

                    </div>

                  </div>


                  <button
                    type="submit"
                    className="record-submit"
                  >
                    Crear y minar registro
                  </button>

                </form>

              </div>

            )}

          </>

        )}


        {/* =================================================
            BLOCKCHAIN
        ================================================= */}

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

                    <span>
                      ESTADO DE LA CADENA
                    </span>

                    <h3>
                      {blockchain.valid
                        ? "Blockchain válida"
                        : "Blockchain inválida"}
                    </h3>

                    <p>
                      {blockchain.message}
                    </p>

                  </div>


                  <div
                    className={
                      blockchain.valid
                        ? "chain-valid"
                        : "chain-invalid"
                    }
                  >
                    {blockchain.valid
                      ? "✓ Válida"
                      : "! Error"}
                  </div>

                </div>


                <div className="blockchain-stats">

                  <div className="block-stat">

                    <span>
                      BLOQUES
                    </span>

                    <strong>
                      {blockchain.blocks}
                    </strong>

                  </div>


                  <div className="block-stat">

                    <span>
                      REGISTROS
                    </span>

                    <strong>
                      {blockchain.records}
                    </strong>

                  </div>


                  <div className="block-stat">

                    <span>
                      DIFICULTAD
                    </span>

                    <strong>
                      {blockchain.complexity}
                    </strong>

                  </div>


                  <div className="block-stat">

                    <span>
                      PRUEBA
                    </span>

                    <strong>
                      {blockchain.proof_of_work}
                    </strong>

                  </div>

                </div>


                <div className="dashboard-panel">

                  <div className="panel-header">

                    <div>

                      <h3>
                        Último hash
                      </h3>

                      <p>
                        Identificador criptográfico
                        del último bloque.
                      </p>

                    </div>

                  </div>


                  <div className="hash-display">

                    {blockchain.last_hash ||
                      "Sin hash"}

                  </div>

                </div>

              </>

            ) : (

              <div className="empty-state">

                <h3>
                  No se pudo consultar la cadena
                </h3>

              </div>

            )}

          </div>

        )}

      </main>

    </div>
  );
}


/* =========================================================
   TABLA DE PACIENTES
========================================================= */

function PatientTable({
  patients,
  onSelectPatient,
}) {

  return (

    <section className="dashboard-panel">

      <div className="panel-header">

        <div>

          <h3>
            Pacientes
          </h3>

          <p>
            Selecciona un paciente para
            consultar su información.
          </p>

        </div>

        <div className="patient-count">
          {patients.length} pacientes
        </div>

      </div>


      {patients.length === 0 ? (

        <div className="empty-state">

          <div className="empty-icon">
            ♙
          </div>

          <h3>
            No hay pacientes
          </h3>

          <p>
            No existen pacientes disponibles.
          </p>

        </div>

      ) : (

        <div className="patients-table">

          <div className="table-header">

            <span>
              Paciente
            </span>

            <span>
              Identificación
            </span>

            <span>
              Estado
            </span>

            <span></span>

          </div>


          {patients.map(
            (patient) => (

              <div
                className="patient-row"
                key={patient.id}
                onClick={() =>
                  onSelectPatient(
                    patient
                  )
                }
              >

                <div className="patient-name">

                  <div className="patient-avatar">

                    {patient.nombre
                      ?.charAt(0)
                      .toUpperCase()}

                  </div>

                  <div>

                    <strong>
                      {patient.nombre}
                    </strong>

                    <span>
                      Paciente
                    </span>

                  </div>

                </div>


                <span className="patient-id">

                  {patient.dui ||
                    patient.id}

                </span>


                <span className="status-badge">

                  <i></i>

                  Registrado

                </span>


                <button
                  className="view-button"
                  onClick={(e) => {

                    e.stopPropagation();

                    onSelectPatient(
                      patient
                    );

                  }}
                >
                  Ver historial →
                </button>

              </div>

            )
          )}

        </div>

      )}

    </section>
  );
}