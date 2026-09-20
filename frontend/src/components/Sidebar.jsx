import React from 'react';
import Brand from './Brand';

export default function Sidebar({ user, onLogout, onBlockchain }) {
  return (
    <aside className="sidebar">
      <Brand compact />
      <div className="sidebar-divider" />
      <div className="user-card">
        <div className="avatar">{user.nombre?.charAt(0) || 'U'}</div>
        <div><strong>{user.nombre}</strong><span>{user.rol}</span></div>
      </div>
      <nav className="nav">
        <div className="nav-title">SISTEMA</div>
        <button className="nav-item active"><span>⌂</span> Panel principal</button>
        {(user.rol === 'ADMIN' || user.rol === 'PROFESIONAL') && (
          <button className="nav-item" onClick={onBlockchain}><span>◈</span> Blockchain</button>
        )}
      </nav>
      <button className="logout" onClick={onLogout}>↪ Cerrar sesión</button>
    </aside>
  );
}
