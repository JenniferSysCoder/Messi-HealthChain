import { useEffect, useState } from "react";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import { getProfile, logout } from "./services/api";
import "./styles.css";


const STORAGE_VERSION = "messi-healthchain-role-flow-v4";

function useStorageMigration() {
  const current = localStorage.getItem("healthchain_storage_version");
  if (current !== STORAGE_VERSION) {
    [
      "healthchain_nodes",
      "healthchain_nodes_cache",
      "healthchain_selected_node",
      "healthchain_active_node",
      "healthchain_patients",
      "healthchain_patients_cache",
    ].forEach((key) => localStorage.removeItem(key));
    localStorage.setItem("healthchain_storage_version", STORAGE_VERSION);
  }
}

export default function App() {
  useStorageMigration();
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("healthchain_user")) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("healthchain_token")));

  useEffect(() => {
    const token = localStorage.getItem("healthchain_token");
    if (!token) { setLoading(false); return; }
    getProfile()
      .then((r) => {
        localStorage.setItem("healthchain_user", JSON.stringify(r.usuario));
        localStorage.setItem("healthchain_session_active", "true");
        setUser(r.usuario);
      })
      .catch(() => { logout(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  function handleLogin(data) {
    localStorage.setItem("healthchain_session_active", "true");
    localStorage.setItem("healthchain_user", JSON.stringify(data.usuario));
    setUser(data.usuario);
  }

  function handleLogout() {
    logout();
    localStorage.removeItem("healthchain_selected_node");
    setUser(null);
  }

  if (loading) return <div className="loading-screen"><div className="loader-card">MESSI <b>HealthChain</b><span>Inicializando portal…</span></div></div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;
  return <DashboardPage user={user} onLogout={handleLogout} />;
}
