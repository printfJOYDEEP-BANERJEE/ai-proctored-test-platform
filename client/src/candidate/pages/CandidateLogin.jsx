// Candidate Login page
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthContext';
import api from '../../services/apiClient';
import toast from 'react-hot-toast';

export default function CandidateLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.candidateLogin(form);
      const candidate = { ...data.candidate, type: 'candidate' };
      login(candidate, data.token, data.refreshToken);
      toast.success(`Welcome back, ${data.candidate.name}!`);
      navigate('/candidate/join');
    } catch (err) {
      // FR-1.2: 401 if account expired
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🌐</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A2B3C' }}>Globussoft Technology</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Candidate Portal</div>
          </div>
        </div>

        <h1 className="auth-title">Sign In</h1>
        <p className="auth-subtitle">Enter your credentials to access the test</p>

        {error && (
          <div className="alert alert-danger">
            {error.includes('expired')
              ? '⏰ Your account has expired (3-day window). Please register again.'
              : error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            id="candidate-login-btn"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Signing in...</> : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: '#6b7280' }}>
          New candidate? <Link to="/candidate/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
