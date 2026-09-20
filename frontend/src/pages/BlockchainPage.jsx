import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import BlockchainStatus from '../components/BlockchainStatus';
import { getBlockchain } from '../services/api';
export default function BlockchainPage() { const [data, setData] = useState(null), [error, setError] = useState(''); useEffect(() => { getBlockchain().then(setData).catch(e => setError(e.message)); }, []); return <><Header title="Blockchain" subtitle="Verificación de integridad y estado de la cadena." />{error && <div className="error-box">{error}</div>}{data && <BlockchainStatus data={data} />}</>; }
