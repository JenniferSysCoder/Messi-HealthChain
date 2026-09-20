import { useState } from "react";

import { login } from "../services/api";


export default function LoginPage({
  onLogin
}) {

  const [
    username,
    setUsername
  ] = useState("");


  const [
    password,
    setPassword
  ] = useState("");


  const [
    loading,
    setLoading
  ] = useState(false);


  const [
    error,
    setError
  ] = useState("");


  async function handleSubmit(e) {

    e.preventDefault();

    setError("");

    setLoading(true);


    try {

      const data =
        await login(
          username,
          password
        );


      if (!data?.success) {

        throw new Error(
          data?.message ||
          "Usuario o contraseña incorrectos"
        );
      }


      onLogin(data);

    } catch (err) {

      console.error(err);

      setError(
        err.message ||
        "No se pudo iniciar sesión"
      );

    } finally {

      setLoading(false);
    }
  }


  return (

    <div className="login-screen">

      <section className="login-left">

        <div className="login-left-content">

          <div className="healthchain-brand">

            <div className="healthchain-logo">
              <span>M10</span>
              <small>+</small>
            </div>


            <div className="healthchain-name">

              <div>
                MESSI{" "}
                <strong>
                  HealthChain
                </strong>
              </div>

              <p>
                Salud segura, un mejor futuro
              </p>

            </div>

          </div>


          <div className="login-main-text">

            <h1>
              Historia clínica segura.
            </h1>

            <p>
              Consulta y gestiona información
              clínica mediante una arquitectura
              Cliente-Servidor y Blockchain.
            </p>

          </div>


          <div className="login-features">

            <div className="login-feature">
              <span>✓</span>
              <p>Datos cifrados</p>
            </div>

            <div className="login-feature">
              <span>✓</span>
              <p>Acceso autorizado</p>
            </div>

            <div className="login-feature">
              <span>✓</span>
              <p>Cadena verificable</p>
            </div>

          </div>

        </div>

      </section>


      <section className="login-right">

        <div className="login-form-container">

          <div className="login-label">
            PORTAL SEGURO
          </div>


          <h2>
            Iniciar sesión
          </h2>


          <p className="login-description">
            Ingrese sus credenciales para continuar.
          </p>


          <form
            onSubmit={handleSubmit}
          >

            <div className="login-field">

              <label>
                Usuario
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
                required
              />

            </div>


            <div className="login-field">

              <label>
                Contraseña
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                required
              />

            </div>


            {error && (

              <div className="login-error">
                {error}
              </div>

            )}


            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >

              {loading
                ? "Ingresando..."
                : "Ingresar al sistema"}

            </button>

          </form>


          <div className="login-demo">
            Demo: dr.messi / Medico123!
          </div>

        </div>

      </section>

    </div>
  );
}