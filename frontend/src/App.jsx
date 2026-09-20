import { useEffect, useState } from "react";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

import {
    getMe,
    getPatientHistory,
    getPatients,
    normalizePatientsResponse,
} from "./services/api";

export default function App() {
    const [user, setUser] = useState(null);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [dashboardError, setDashboardError] = useState("");

    async function loadUserAndPatients(currentUser) {
        setUser(currentUser);
        setDashboardError("");

        if (!currentUser) {
            setPatients([]);
            setHistory([]);
            setSelectedPatient(null);
            return;
        }

        if (currentUser.rol === "PACIENTE") {
            setPatients([]);
            const patientId = currentUser.paciente_id;

            if (patientId) {
                setSelectedPatient({
                    id: patientId,
                    nombre: currentUser.nombre,
                });

                try {
                    setLoadingHistory(true);
                    const response = await getPatientHistory(patientId);
                    setHistory(response?.historial || []);
                } catch (error) {
                    console.error(error);
                    setDashboardError(error.message);
                    setHistory([]);
                } finally {
                    setLoadingHistory(false);
                }
            }

            return;
        }

        if (currentUser.rol === "PROFESIONAL" || currentUser.rol === "ADMIN") {
            try {
                const response = await getPatients();
                setPatients(normalizePatientsResponse(response));
            } catch (error) {
                console.error(error);
                setPatients([]);
                setDashboardError(error.message);
            }
        }
    }

    useEffect(() => {
        const token = localStorage.getItem("healthchain_token");

        if (!token) {
            setLoading(false);
            return;
        }

        async function loadUser() {
            try {
                const currentUser = await getMe();
                await loadUserAndPatients(currentUser);
            } catch (error) {
                console.error(error);
                localStorage.removeItem("healthchain_token");
                localStorage.removeItem("healthchain_user");
            } finally {
                setLoading(false);
            }
        }

        loadUser();
    }, []);

    async function handleLogin(loginResponse) {
        const currentUser = loginResponse?.usuario;
        await loadUserAndPatients(currentUser);
    }

    function handleLogout() {
        localStorage.removeItem("healthchain_token");
        localStorage.removeItem("healthchain_user");
        setUser(null);
        setPatients([]);
        setSelectedPatient(null);
        setHistory([]);
        setDashboardError("");
    }

    async function handleSelectPatient(patient) {
        setSelectedPatient(patient);
        setDashboardError("");
        setLoadingHistory(true);

        try {
            const response = await getPatientHistory(patient.id);
            setHistory(response?.historial || []);
        } catch (error) {
            console.error(error);
            setDashboardError(error.message);
            setHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }

    function handleBackToPatients() {
        setSelectedPatient(null);
        setHistory([]);
        setDashboardError("");
    }

    async function reloadSelectedPatientHistory() {
        if (!selectedPatient) {
            return;
        }

        setLoadingHistory(true);
        setDashboardError("");

        try {
            const response = await getPatientHistory(selectedPatient.id);
            setHistory(response?.historial || []);
        } catch (error) {
            console.error(error);
            setDashboardError(error.message);
        } finally {
            setLoadingHistory(false);
        }
    }

    async function reloadPatients() {
        try {
            const response = await getPatients();
            setPatients(normalizePatientsResponse(response));
        } catch (error) {
            console.error(error);
            setDashboardError(error.message);
        }
    }

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-card">Cargando MESSI HealthChain...</div>
            </div>
        );
    }

    if (!user) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return (
        <DashboardPage
            user={user}
            patients={patients}
            selectedPatient={selectedPatient}
            history={history}
            loadingHistory={loadingHistory}
            error={dashboardError}
            onSelectPatient={handleSelectPatient}
            onBackToPatients={handleBackToPatients}
            onHistoryReload={reloadSelectedPatientHistory}
            onLogout={handleLogout}
            onPatientsReload={reloadPatients}
        />
    );
}