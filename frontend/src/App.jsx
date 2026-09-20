import {
    useEffect,
    useState
} from "react";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";

import {
    getMe,
    getPatients,
    normalizePatientsResponse,
} from "./services/api";


export default function App() {

    const [user, setUser] =
        useState(null);

    const [patients, setPatients] =
        useState([]);

    const [selectedPatient, setSelectedPatient] =
        useState(null);

    const [loading, setLoading] =
        useState(true);


    async function loadUserAndPatients(
        currentUser
    ) {

        setUser(currentUser);

        if (
            currentUser?.rol ===
            "PROFESIONAL" ||
            currentUser?.rol ===
            "ADMIN"
        ) {

            const response =
                await getPatients();

            setPatients(
                normalizePatientsResponse(
                    response
                )
            );

        } else {

            setPatients([]);
        }
    }


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

                await loadUserAndPatients(
                    currentUser
                );

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


    async function handleLogin(
        loginResponse
    ) {

        const currentUser =
            loginResponse?.usuario;

        await loadUserAndPatients(
            currentUser
        );
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
    }


    function handleSelectPatient(patient) {
        setSelectedPatient(patient);
    }


    function handleBackToPatients() {
        setSelectedPatient(null);
    }


    async function reloadPatients() {

        try {

            const response =
                await getPatients();

            setPatients(
                normalizePatientsResponse(
                    response
                )
            );

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
            onSelectPatient={handleSelectPatient}
            onBackToPatients={handleBackToPatients}
            onLogout={handleLogout}
            onPatientsReload={
                reloadPatients
            }
        />
    );
}