import { useState } from "react";
import { login } from "../services/api";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(username.trim(), password);
      onLogin(result);
    } catch (err) {
      setError(err.message || "Usuario o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <div className="brand">
          <div className="brand-mark">M10<span>+</span></div>
          <div><strong>MESSI HealthChain</strong><small>Historia clínica digital</small></div>
        </div>
        <div className="hero-copy">
          <span className="eyebrow">HISTORIA CLÍNICA DIGITAL</span>
          <h1>La información clínica, organizada y conectada.</h1>
          <p>Un sistema para gestionar pacientes, historiales y registros clínicos mediante una red de nodos HealthChain.</p>
        </div>
        <div className="hero-points">
          <span>✓ Roles autorizados</span>
          <span>✓ Historial clínico</span>
          <span>✓ Red de nodos</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">ACCESO AL SISTEMA</span>
          <h2>Iniciar sesión</h2>
          <p>Ingresa tus credenciales para continuar.</p>
          <form onSubmit={submit}>
            <label>Usuario
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required placeholder="Ingresa tu usuario" />
            </label>
            <label>Contraseña
              <div style={{ position: "relative" }}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Ingresa tu contraseña" style={{ paddingRight: 82 }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 8, top: 7, height: 38, border: 0, borderRadius: 9, background: "#f0f8fb", color: "#398eae", padding: "0 11px", fontWeight: 700 }}>
                  {showPassword ? "Ocultar" : "Ver"}
                </button>
              </div>
            </label>
            {error && <div className="alert danger">{error}</div>}
            <button className="primary full" disabled={loading}>{loading ? "Validando…" : "Ingresar al sistema"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
