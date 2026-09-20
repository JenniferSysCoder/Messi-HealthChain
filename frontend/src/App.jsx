import {
    useEffect,
    useState
} from "react";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

import {
    getMe,
    getPatients,
    getPatientHistory
} from "./services/api";


export default function App() {

    const [user, setUser] =
        useState(null);

    const [patients, setPatients] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [selectedPatient, setSelectedPatient] =
        useState(null);

    const [history, setHistory] =
        useState([]);

    const [loadingHistory, setLoadingHistory] =
        useState(false);

    const [error, setError] =
        useState("");


    useEffect(() => {

        const token =
            localStorage.getItem(
                "healthchain_token"
            );

        if (!token) {
            setLoading(false);
            return;
        }


        async function loadUser() {

            try {

                const currentUser =
                    await getMe();

                setUser(
                    currentUser
                );


                if (
                    currentUser.rol ===
                    "PROFESIONAL" ||
                    currentUser.rol ===
                    "ADMIN"
                ) {

                    const response =
                        await getPatients();

                    if (
                        Array.isArray(response)
                    ) {

                        setPatients(
                            response
                        );

                    } else if (
                        Array.isArray(
                            response.pacientes
                        )
                    ) {

                        setPatients(
                            response.pacientes
                        );

                    } else {

                        setPatients([]);

                    }

                }

            } catch (error) {

                console.error(
                    error
                );

                localStorage.removeItem(
                    "healthchain_token"
                );

                localStorage.removeItem(
                    "healthchain_user"
                );

            } finally {

                setLoading(false);
            }
        }


        loadUser();

    }, []);


    function handleLogin(
        loginResponse
    ) {

        setUser(
            loginResponse.usuario
        );
    }


    async function handleSelectPatient(patient) {

        setSelectedPatient(patient);
        setHistory([]);
        setError("");
        setLoadingHistory(true);

        try {

            const response =
                await getPatientHistory(
                    patient.id
                );

            setHistory(
                Array.isArray(response)
                    ? response
                    : []
            );

        } catch (error) {

            console.error(error);

            setHistory([]);

            setError(
                error.message ||
                "No fue posible consultar el historial del paciente."
            );

        } finally {

            setLoadingHistory(false);
        }
    }


    function handleBackToPatients() {

        setSelectedPatient(null);
        setHistory([]);
        setError("");
    }


    function handleLogout() {

        localStorage.removeItem(
            "healthchain_token"
        );

        localStorage.removeItem(
            "healthchain_user"
        );

        setUser(null);
        setPatients([]);
        setSelectedPatient(null);
        setHistory([]);
        setError("");
    }


    async function reloadPatients() {

        try {

            const response =
                await getPatients();

            if (
                Array.isArray(response)
            ) {

                setPatients(response);

            } else if (
                Array.isArray(
                    response.pacientes
                )
            ) {

                setPatients(
                    response.pacientes
                );

            }

        } catch (error) {

            console.error(
                error
            );
        }
    }


    if (loading) {

        return (
            <div className="loading-screen">
                <div className="loading-card">
                    Cargando MESSI HealthChain...
                </div>
            </div>
        );
    }


    if (!user) {

        return (
            <LoginPage
                onLogin={handleLogin}
            />
        );
    }


    return (
        <DashboardPage
            user={user}
            patients={patients}
            selectedPatient={selectedPatient}
            history={history}
            loadingHistory={loadingHistory}
            error={error}
            onSelectPatient={handleSelectPatient}
            onBackToPatients={handleBackToPatients}
            onLogout={handleLogout}
            onPatientsReload={
                reloadPatients
            }
        />
    );
}