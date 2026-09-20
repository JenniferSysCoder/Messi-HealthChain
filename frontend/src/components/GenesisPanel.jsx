import { useState } from "react";
import { createGenesis } from "../services/api";


export default function GenesisPanel({
    onCreated
}) {

    const [complexity, setComplexity] =
        useState(4);

    const [proofChar, setProofChar] =
        useState("0");

    const [loading, setLoading] =
        useState(false);

    const [result, setResult] =
        useState(null);

    const [error, setError] =
        useState("");


    const proof =
        proofChar.repeat(
            Math.max(
                0,
                Number(complexity) || 0
            )
        );


    async function handleCreate() {

        setLoading(true);
        setError("");
        setResult(null);

        try {

            const response =
                await createGenesis(
                    Number(complexity),
                    proofChar
                );

            setResult(response);

            if (
                response.success &&
                onCreated
            ) {
                onCreated();
            }

        } catch (err) {

            setError(
                err.message ||
                "No fue posible crear Genesis."
            );

        } finally {

            setLoading(false);
        }
    }


    return (
        <div className="genesis-panel">

            <div className="genesis-header">

                <div>

                    <span className="genesis-label">
                        BLOCKCHAIN
                    </span>

                    <h2>
                        Inicializar
                        MESSI HealthChain
                    </h2>

                    <p>
                        Crea y mina el bloque
                        Genesis de la cadena.
                    </p>

                </div>

                <div className="genesis-icon">
                    🔗
                </div>

            </div>


            <div className="genesis-warning">

                <strong>
                    La Blockchain todavía
                    no está inicializada.
                </strong>

                <span>
                    Configure la dificultad
                    de la prueba de trabajo
                    y cree el bloque Genesis.
                </span>

            </div>


            <div className="genesis-form">

                <div className="form-group">

                    <label>
                        Complejidad de minería
                    </label>

                    <input
                        type="number"
                        min="1"
                        max="6"
                        value={complexity}
                        onChange={(event) =>
                            setComplexity(
                                event.target.value
                            )
                        }
                    />

                    <small>
                        Número de caracteres
                        requeridos al inicio
                        del hash.
                    </small>

                </div>


                <div className="form-group">

                    <label>
                        Carácter de Proof of Work
                    </label>

                    <input
                        type="text"
                        maxLength="1"
                        value={proofChar}
                        onChange={(event) =>
                            setProofChar(
                                event.target.value
                            )
                        }
                    />

                    <small>
                        Para HealthChain
                        utilizaremos 0.
                    </small>

                </div>

            </div>


            <div className="proof-preview">

                <span>
                    Proof of Work requerido
                </span>

                <strong>
                    {proof || "----"}
                </strong>

            </div>


            <button
                className="genesis-button"
                onClick={handleCreate}
                disabled={
                    loading ||
                    !proofChar
                }
            >

                {loading
                    ? "⛏ Minando Genesis..."
                    : "⛏ Crear y minar Genesis"}

            </button>


            {error && (

                <div className="genesis-error">
                    {error}
                </div>

            )}


            {result?.success && (

                <div className="genesis-result">

                    <h3>
                        ✓ Genesis creado correctamente
                    </h3>

                    <p>
                        La Blockchain fue
                        inicializada y validada.
                    </p>

                    {result.status?.genesis && (

                        <>

                            <div className="genesis-data">

                                <div>
                                    <span>
                                        Bloque
                                    </span>

                                    <strong>
                                        {
                                            result
                                                .status
                                                .genesis
                                                .id
                                        }
                                    </strong>
                                </div>


                                <div>
                                    <span>
                                        Nonce
                                    </span>

                                    <strong>
                                        {
                                            result
                                                .status
                                                .genesis
                                                .nonce
                                        }
                                    </strong>
                                </div>


                                <div>
                                    <span>
                                        Proof of Work
                                    </span>

                                    <strong>
                                        {
                                            result
                                                .status
                                                .proof_of_work
                                        }
                                    </strong>
                                </div>

                            </div>


                            <div className="hash-box">

                                <span>
                                    HASH DEL GENESIS
                                </span>

                                <code>
                                    {
                                        result
                                            .status
                                            .genesis
                                            .hash
                                    }
                                </code>

                            </div>

                        </>

                    )}

                </div>

            )}

        </div>
    );
}