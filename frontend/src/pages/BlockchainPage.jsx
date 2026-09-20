import { useEffect, useState } from "react";

import BlockchainStatus from "../components/BlockchainStatus";
import Header from "../components/Header";
import { getBlockchainStatus } from "../services/api";

export default function BlockchainPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await getBlockchainStatus();
        if (active) {
          setData(response);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "No se pudo consultar la Blockchain.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Header title="Blockchain" subtitle="Verificación de integridad y estado de la cadena." />
      {loading && <div className="loading-state">Consultando Blockchain...</div>}
      {error && <div className="error-box">{error}</div>}
      {data && <BlockchainStatus data={data} />}
    </>
  );
}
