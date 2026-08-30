// AdminCreateAdmin.jsx — Super Admin Account Provisioning
// Implements PRD Section 3 (Roles Matrix), Section 8.2 (Admin Schema), Section 9.1, Section 11.1 (FR-1.1)
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminNavbar from '../../shared/AdminNavbar';
import api from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuthContext';

export default function AdminCreateAdmin() {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
  });
  const [loading, setLoading] = useState(false);
  const [createdAdmins, setCreatedAdmins] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      return toast.error('All fields are required');
    }

    if (formData.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    try {
      setLoading(true);
      // POST /api/v1/auth/admin/create (FR-1.1: Super Admin only)
      const res = await api.adminCreate({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
      });

      const newAdmin = res.data.admin;
      toast.success(`Admin account created for ${newAdmin.name} (${newAdmin.role})`);

      // Track newly created admins in current session
      setCreatedAdmins((prev) => [newAdmin, ...prev]);

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'ADMIN',
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <AdminNavbar />
      <main className="main-content">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <Link to="/admin" style={{ color: '#0E7C86', fontWeight: 500 }}>
            ← Dashboard
          </Link>
          <span style={{ color: '#9ca3af' }}>/</span>
          <span style={{ color: '#4b5563', fontWeight: 600 }}>Manage Admins</span>
        </div>

        {/* Header */}
        <div className="card" style={{ marginBottom: 24, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: '1.7rem', color: '#1A2B3C', fontWeight: 800 }}>
                  Admin Account Management
                </h1>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', background: '#0E7C86' }}>
                  Super Admin Only (FR-1.1)
                </span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 4 }}>
                Provision organizational admin accounts with Role-Based Access Control (RBAC).
              </p>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Logged in as: <strong>{user?.name}</strong> (<span style={{ color: '#2ECC71', fontWeight: 700 }}>{user?.role}</span>)
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Form & Permissions Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.2fr) minmax(300px, 1fr)', gap: 24 }}>
          
          {/* Create Admin Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Create Admin Account</h3>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="e.g. Priya Sharma"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    placeholder="e.g. priya.sharma@globussoft.in"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Temporary Password *</label>
                  <input
                    type="password"
                    name="password"
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Role Assignment *</label>
                  <select
                    name="role"
                    className="form-select"
                    value={formData.role}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="ADMIN">ADMIN — Standard Access</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN — Full Control</option>
                  </select>
                  <small style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                    {formData.role === 'SUPER_ADMIN'
                      ? '⚠️ SUPER_ADMIN can create and manage other Admin accounts.'
                      : 'ℹ️ ADMIN can create tests, manage rooms, monitor live sessions, and view results.'}
                  </small>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ marginTop: 8 }}
                >
                  {loading ? 'Provisioning Account...' : '+ Create Admin Account'}
                </button>
              </div>
            </form>
          </div>

          {/* Role Permissions Matrix (Section 3) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Role Permissions Matrix (Section 3)</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem' }}>
                <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>SUPER_ADMIN</span>
                    <strong style={{ color: '#1A2B3C' }}>Full Platform Control</strong>
                  </div>
                  <ul style={{ paddingLeft: 18, color: '#4b5563', lineHeight: 1.6, fontSize: '0.8rem' }}>
                    <li>Create &amp; manage other Admin accounts (FR-1.1)</li>
                    <li>Create, configure, start, and end tests</li>
                    <li>Manage Question Sets &amp; Question Bank</li>
                    <li>Live proctoring monitoring, warnings, &amp; disqualifications</li>
                    <li>Recalculate passing criteria &amp; malpractice thresholds</li>
                    <li>Export branded shortlist PDFs</li>
                  </ul>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>ADMIN</span>
                    <strong style={{ color: '#1A2B3C' }}>Test Operations &amp; Proctoring</strong>
                  </div>
                  <ul style={{ paddingLeft: 18, color: '#4b5563', lineHeight: 1.6, fontSize: '0.8rem' }}>
                    <li>Create &amp; manage tests and physical test rooms</li>
                    <li>Manage Question Sets &amp; Question Bank</li>
                    <li>Live proctoring monitoring &amp; malpractice review</li>
                    <li>Export shortlisted candidate PDFs</li>
                    <li style={{ color: '#E74C3C', fontWeight: 600 }}>Cannot create other Admin accounts (403 Forbidden)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Session Created Admins List */}
            {createdAdmins.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Provisioned This Session ({createdAdmins.length})</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {createdAdmins.map((adm, i) => (
                    <div
                      key={adm.id || i}
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#1A2B3C' }}>{adm.name}</strong>
                        <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>{adm.email}</div>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        {adm.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
