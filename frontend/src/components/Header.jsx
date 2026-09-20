import React from 'react';

export default function Header({ title, subtitle }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="secure-badge"><span>●</span> Cadena protegida</div>
    </header>
  );
}
