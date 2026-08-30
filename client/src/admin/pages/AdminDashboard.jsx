// Admin Dashboard — placeholder; full implementation in Module 6 (Live Dashboard)
import React from 'react';
import { Link } from 'react-router-dom';
import AdminNavbar from '../../shared/AdminNavbar';
import { useAuth } from '../../hooks/useAuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="app-layout">
      <AdminNavbar />
      <main className="main-content">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.8rem', color: '#1A2B3C' }}>Welcome, {user?.name}</h1>
          <p style={{ color: '#6b7280' }}>Globussoft Technology — Admin Panel</p>
        </div>
        <div className="stats-grid">
          {[
            { label: 'Quick Link', value: '→', sub: 'Tests', to: '/admin/tests' },
            { label: 'Quick Link', value: '→', sub: 'Question Bank', to: '/admin/question-bank' },
          ].map((s, i) => (
            <Link to={s.to} key={i} className="stat-card" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.sub}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
