import React from 'react';

export default function Brand({ compact = false }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'}>
      <div className="brand-mark">M10<span>+</span></div>
      <div>
        <div className="brand-name">MESSI <strong>HealthChain</strong></div>
        {!compact && <div className="brand-tagline">Salud segura, un mejor futuro</div>}
      </div>
    </div>
  );
}
