// CandidateJoinRoom — POST /rooms/join (§9.5)
// AC: 403 "Room code expired" if passwordValidUntil passed (FR-3.3)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuthContext';

export default function CandidateJoinRoom() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ roomCode: '', roomPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value.toUpperCase() }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.joinRoom(form);
      // Store join data in sessionStorage for the instructions page
      sessionStorage.setItem('joinData', JSON.stringify(data));
      navigate('/candidate/instructions');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to join room';
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
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Technology Ahead of Time</div>
          </div>
        </div>

        <h1 className="auth-title">Join Test Room</h1>
        <p className="auth-subtitle">
          Welcome, <strong>{user?.name}</strong>!<br />
          Enter the Room ID and password provided by your proctor.
        </p>

        {error && (
          <div className="alert alert-danger">
            {error.includes('expired') || error.includes('Expired')
              ? '🔒 Room access window has closed. Contact your proctor for assistance.'
              : error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="roomCode">Room Code</label>
            <input
              id="roomCode"
              name="roomCode"
              type="text"
              className="form-input"
              value={form.roomCode}
              onChange={handleChange}
              placeholder="e.g., A3K9MQ"
              required
              maxLength={10}
              autoComplete="off"
              style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '0.15em', textAlign: 'center' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="roomPassword">Room Password</label>
            <input
              id="roomPassword"
              name="roomPassword"
              type="text"
              className="form-input"
              value={form.roomPassword}
              onChange={handleChange}
              placeholder="Provided by proctor"
              required
              autoComplete="off"
              style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}
            />
          </div>

          <button
            type="submit"
            id="join-room-btn"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Joining...</> : '→ Enter Test Room'}
          </button>
        </form>

        <div className="alert alert-warning" style={{ marginTop: 16, marginBottom: 0 }}>
          <div>
            <strong>Before you start:</strong>
            <ul style={{ marginTop: 8, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Allow webcam and microphone access when prompted</li>
              <li>Ensure you are in a well-lit, quiet environment</li>
              <li>Close all other browser tabs and applications</li>
              <li>Use only <strong>Chrome</strong> or <strong>Edge</strong> browser</li>
            </ul>
          </div>
        </div>

        <button
          onClick={() => { logout(); navigate('/candidate/login'); }}
          style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem', cursor: 'pointer', marginTop: 16, width: '100%' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
