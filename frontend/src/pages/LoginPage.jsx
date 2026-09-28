import { useState } from "react";
import { login } from "../services/api";

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const result = await login(username, password); onLogin(result); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  return <main className="login-shell">
    <section className="login-hero">
      <div className="brand"><div className="brand-mark">M10<span>+</span></div><div><strong>MESSI HealthChain</strong><small>Salud segura, un mejor futuro</small></div></div>
      <div className="hero-copy"><span className="eyebrow">BLOCKCHAIN · CLIENTE/SERVIDOR</span><h1>Historia clínica segura, verificable y conectada.</h1><p>HealthChain protege los registros clínicos mediante cifrado, Proof of Work y una red de nodos TCP/IP.</p></div>
      <div className="hero-points"><span>✓ Datos cifrados</span><span>✓ Roles autorizados</span><span>✓ Red de nodos reales</span></div>
    </section>
    <section className="login-panel"><div className="login-card"><span className="eyebrow">PORTAL SEGURO</span><h2>Iniciar sesión</h2><p>Ingresa tus credenciales para acceder a HealthChain.</p><form onSubmit={submit}><label>Usuario<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></label><label>Contraseña<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <div className="alert danger">{error}</div>}<button className="primary full" disabled={loading}>{loading ? "Validando…" : "Ingresar al sistema"}</button></form><div className="demo-box">Demo profesional: <b>dr.messi</b> / <b>Medico123!</b></div></div></section>
  </main>;
}
