// Placeholder — built in Module 4 (AI Test)
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CandidateAITestScreen() {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: '#1A2B3C' }}>
      <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>AI Test Module</div>
      <div style={{ color: 'rgba(255,255,255,0.6)' }}>This screen is built in Module 4</div>
    </div>
  );
}
