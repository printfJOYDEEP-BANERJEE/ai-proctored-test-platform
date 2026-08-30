// Shared Navbar component — Globussoft branding (Section 14)
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuthContext';
import toast from 'react-hot-toast';
import api from '../services/apiClient';

export default function AdminNavbar() {
  const { user, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    logout();
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  const isActive = (path) => location.pathname.startsWith(path) ? 'active' : '';

  return (
    <nav className="navbar">
      {/* Globussoft Logo (Section 14) */}
      <div className="navbar-brand">
        <div className="globe-icon">🌐</div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800 }}>Globussoft Technology</div>
          <div style={{ fontSize: '0.65rem', fontWeight: 400, opacity: 0.7 }}>Admin Panel</div>
        </div>
      </div>

      <div className="navbar-nav">
        <Link to="/admin" className={isActive('/admin') && location.pathname === '/admin' ? 'active' : ''}>
          Dashboard
        </Link>
        <Link to="/admin/tests" className={isActive('/admin/tests')}>Tests</Link>
        <Link to="/admin/question-bank" className={isActive('/admin/question-bank')}>
          Question Bank
        </Link>
        {isSuperAdmin && (
          <Link to="/admin/create-admin" className={isActive('/admin/create-admin')}>
            Manage Admins
          </Link>
        )}
        <div style={{ marginLeft: 16, borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            {user?.name} · <span style={{ color: '#2ECC71' }}>{user?.role}</span>
          </span>
        </div>
        <button onClick={handleLogout} style={{ color: '#E74C3C' }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
