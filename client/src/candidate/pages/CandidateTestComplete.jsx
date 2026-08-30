// CandidateTestComplete — shown after submit-all or auto-submit
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuthContext';

export default function CandidateTestComplete() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleDone = () => {
    // Clear session data
    sessionStorage.removeItem('testSession');
    sessionStorage.removeItem('joinData');
    logout();
    navigate('/candidate/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1A2B3C 0%, #0E7C86 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 48, maxWidth: 520,
        width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: '2rem', color: '#1A2B3C', marginBottom: 12 }}>
          Test Submitted!
        </h1>
        <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: 24, fontSize: '1rem' }}>
          Your test has been successfully submitted,{' '}
          <strong>{user?.name}</strong>. Our team will review and evaluate your submission.
        </p>

        <div style={{
          background: '#f0fdf4', border: '1px solid #6ee7b7', borderRadius: 12,
          padding: 16, marginBottom: 24, textAlign: 'left',
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#065f46', marginBottom: 8 }}>
            What happens next?
          </h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.875rem', color: '#374151' }}>
            <li>✓ Your code is being evaluated automatically</li>
            <li>✓ Results will be reviewed by the Globussoft team</li>
            <li>✓ You'll be contacted if you are shortlisted</li>
          </ul>
        </div>

        <button
          id="done-btn"
          className="btn btn-primary btn-lg"
          onClick={handleDone}
          style={{ width: '100%' }}
        >
          Done — Log Out
        </button>

        <p style={{ marginTop: 16, color: '#9ca3af', fontSize: '0.75rem' }}>
          Globussoft Technology · Technology Ahead of Time
        </p>
      </div>
    </div>
  );
}
