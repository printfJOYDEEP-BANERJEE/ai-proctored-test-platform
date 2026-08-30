// AdminTestDetail.jsx — Test Detail, Configuration & Room Management
// Implements PRD Section 9.2, 9.3, 11.2 (FR-2.1, FR-2.2, FR-2.3), 11.3 (FR-3.1, FR-3.2, FR-3.3)
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminNavbar from '../../shared/AdminNavbar';
import api from '../../services/apiClient';

export default function AdminTestDetail() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic Threshold States (FR-2.2, FR-2.3)
  const [passingCriteria, setPassingCriteria] = useState(3);
  const [updatingPassing, setUpdatingPassing] = useState(false);
  const [malpracticeThreshold, setMalpracticeThreshold] = useState('');
  const [updatingMalpractice, setUpdatingMalpractice] = useState(false);

  // Status Action Modals (Start / End Test)
  const [showStartModal, setShowStartModal] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [ending, setEnding] = useState(false);

  // Add Room Modal State (FR-3.1)
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [roomFormData, setRoomFormData] = useState({
    roomName: '',
    capacity: 50,
  });

  // Room Candidates View Modal
  const [selectedRoomCandidates, setSelectedRoomCandidates] = useState(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // Fetch Test Details & Rooms
  const fetchTestAndRooms = useCallback(async () => {
    try {
      setLoading(true);
      const [testRes, roomsRes] = await Promise.all([
        api.getTest(testId),
        api.getRooms(testId),
      ]);
      const fetchedTest = testRes.data.test;
      setTest(fetchedTest);
      setPassingCriteria(fetchedTest.passingCriteria || 0);
      setMalpracticeThreshold(
        fetchedTest.malpracticeDisqualifyThreshold !== null &&
        fetchedTest.malpracticeDisqualifyThreshold !== undefined
          ? fetchedTest.malpracticeDisqualifyThreshold
          : ''
      );
      setRooms(roomsRes.data.rooms || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load test details');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    fetchTestAndRooms();
  }, [fetchTestAndRooms]);

  // Handle Start Test (DRAFT -> LIVE)
  const handleStartTest = async () => {
    try {
      setStarting(true);
      const res = await api.startTest(testId);
      setTest(res.data.test);
      toast.success('Test is now LIVE! Candidates can join with room codes.');
      setShowStartModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start test');
    } finally {
      setStarting(false);
    }
  };

  // Handle End Test (LIVE -> ENDED)
  const handleEndTest = async () => {
    try {
      setEnding(true);
      const res = await api.endTest(testId);
      setTest(res.data.test);
      toast.success('Test ENDED. Final evaluation worker triggered.');
      setShowEndModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to end test');
    } finally {
      setEnding(false);
    }
  };

  // Handle Passing Criteria Update (FR-2.2)
  const handleUpdatePassingCriteria = async (e) => {
    e.preventDefault();
    if (passingCriteria < 0) {
      return toast.error('Passing criteria cannot be negative');
    }
    try {
      setUpdatingPassing(true);
      const res = await api.updatePassingCriteria(testId, { passingCriteria: Number(passingCriteria) });
      setTest(res.data.test);
      toast.success('Passing criteria updated (Shortlist auto-recalculated)');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update passing criteria');
    } finally {
      setUpdatingPassing(false);
    }
  };

  // Handle Malpractice Threshold Update (FR-2.3, FR-7.5)
  const handleUpdateMalpracticeThreshold = async (e) => {
    e.preventDefault();
    if (test?.status !== 'ENDED') {
      return toast.error('Malpractice threshold can only be set after test has ENDED');
    }
    try {
      setUpdatingMalpractice(true);
      const val = malpracticeThreshold === '' ? null : Number(malpracticeThreshold);
      const res = await api.updateMalpracticeThreshold(testId, {
        malpracticeDisqualifyThreshold: val,
      });
      setTest(res.data.test);
      toast.success('Malpractice threshold updated & shortlist re-filtered');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update malpractice threshold');
    } finally {
      setUpdatingMalpractice(false);
    }
  };

  // Handle Add Room (FR-3.1)
  const handleAddRoomSubmit = async (e) => {
    e.preventDefault();
    if (!roomFormData.roomName.trim()) {
      return toast.error('Room name is required');
    }
    try {
      setAddingRoom(true);
      const res = await api.createRoom(testId, {
        roomName: roomFormData.roomName.trim(),
        capacity: roomFormData.capacity ? Number(roomFormData.capacity) : undefined,
      });
      toast.success(`Created room "${res.data.room?.roomName}"`);
      setShowAddRoomModal(false);
      setRoomFormData({ roomName: '', capacity: 50 });
      // Refresh rooms list
      const roomsRes = await api.getRooms(testId);
      setRooms(roomsRes.data.rooms || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setAddingRoom(false);
    }
  };

  // Handle Delete / Close Room (FR-3.2)
  const handleDeleteRoom = async (roomId, roomName) => {
    if (!window.confirm(`Are you sure you want to close "${roomName}"? New candidates won't be able to join, but active candidates will continue.`)) {
      return;
    }
    try {
      await api.deleteRoom(roomId);
      toast.success(`Closed room "${roomName}"`);
      const roomsRes = await api.getRooms(testId);
      setRooms(roomsRes.data.rooms || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to close room');
    }
  };

  // View Candidates in Room
  const handleViewRoomCandidates = async (room) => {
    try {
      setSelectedRoomCandidates({ room, list: [] });
      setLoadingCandidates(true);
      const res = await api.getRoomCandidates(room._id);
      setSelectedRoomCandidates({ room, list: res.data.candidates || [] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch candidates');
      setSelectedRoomCandidates(null);
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <div className="app-layout">
        <AdminNavbar />
        <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <div className="spinner spinner-dark" style={{ width: 40, height: 40, borderWidth: 3 }} />
        </main>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="app-layout">
        <AdminNavbar />
        <main className="main-content">
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <h3>Test not found</h3>
            <Link to="/admin/tests" className="btn btn-primary" style={{ marginTop: 16 }}>
              Back to Tests
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <AdminNavbar />
      <main className="main-content">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <Link to="/admin/tests" style={{ color: '#0E7C86', fontWeight: 500 }}>
            ← All Tests
          </Link>
          <span style={{ color: '#9ca3af' }}>/</span>
          <span style={{ color: '#4b5563', fontWeight: 600 }}>{test.title}</span>
        </div>

        {/* Top Header Card */}
        <div className="card" style={{ marginBottom: 24, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.7rem', color: '#1A2B3C', fontWeight: 800 }}>{test.title}</h1>
                <span
                  className={`badge ${
                    test.status === 'LIVE'
                      ? 'badge-success'
                      : test.status === 'ENDED'
                      ? 'badge-info'
                      : 'badge-secondary'
                  }`}
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                >
                  {test.status === 'LIVE' && '● '}
                  {test.status}
                </span>
                <span
                  className="badge"
                  style={{
                    background: 'rgba(14, 124, 134, 0.1)',
                    color: '#0E7C86',
                    border: '1px solid rgba(14, 124, 134, 0.3)',
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                  }}
                >
                  {test.testType}
                </span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                Created by <strong>{test.createdBy?.name || 'Admin'}</strong> on{' '}
                {new Date(test.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Status Control Actions */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {test.status === 'DRAFT' && (
                <button
                  onClick={() => setShowStartModal(true)}
                  className="btn btn-primary"
                  style={{ background: '#2ECC71', border: 'none' }}
                >
                  🚀 Start Test (Make LIVE)
                </button>
              )}

              {test.status === 'LIVE' && (
                <>
                  <Link
                    to={`/admin/tests/${test._id}/live`}
                    className="btn btn-primary"
                    style={{ background: '#0E7C86' }}
                  >
                    📊 Open Live Dashboard
                  </Link>
                  <button
                    onClick={() => setShowEndModal(true)}
                    className="btn btn-danger"
                  >
                    ⏹ End Test
                  </button>
                </>
              )}

              {test.status === 'ENDED' && (
                <Link
                  to={`/admin/tests/${test._id}/results`}
                  className="btn btn-primary"
                >
                  🏆 View Results &amp; Shortlist
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Config / Dynamic Thresholds & Room Management */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.3fr)', gap: 24 }}>
          
          {/* Column 1: Test Config & Dynamic Thresholds */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Dynamic Passing Criteria Card (FR-2.2) */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Passing Criteria (FR-2.2)</h3>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Editable Anytime</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 16 }}>
                Number of questions a candidate must solve to pass. Changing this will <strong>automatically recalculate the shortlist</strong>.
              </p>
              <form onSubmit={handleUpdatePassingCriteria} style={{ display: 'flex', gap: 12 }}>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: 100 }}
                  min="0"
                  max="50"
                  value={passingCriteria}
                  onChange={(e) => setPassingCriteria(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={updatingPassing}
                >
                  {updatingPassing ? 'Updating...' : 'Update Criteria'}
                </button>
              </form>
            </div>

            {/* Dynamic Malpractice Threshold Card (FR-2.3, FR-7.5) */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Malpractice Disqualification Threshold (FR-2.3)</h3>
                <span className={`badge ${test.status === 'ENDED' ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '0.7rem' }}>
                  {test.status === 'ENDED' ? 'Active' : 'Post-Test Only'}
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 16 }}>
                Candidates with malpractice counts strictly exceeding this threshold will be excluded from the shortlist.
                <em> (Can only be set after test is ENDED).</em>
              </p>
              <form onSubmit={handleUpdateMalpracticeThreshold} style={{ display: 'flex', gap: 12 }}>
                <input
                  type="number"
                  className="form-control"
                  style={{ width: 100 }}
                  min="0"
                  placeholder="None"
                  disabled={test.status !== 'ENDED'}
                  value={malpracticeThreshold}
                  onChange={(e) => setMalpracticeThreshold(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={test.status !== 'ENDED' || updatingMalpractice}
                >
                  {updatingMalpractice ? 'Updating...' : 'Set Threshold'}
                </button>
              </form>
              {test.status !== 'ENDED' && (
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>
                  🔒 Available when test status changes to ENDED.
                </p>
              )}
            </div>

            {/* Test Configuration Summary */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Configuration Details</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                  <span style={{ color: '#6b7280' }}>Question Set</span>
                  <span style={{ fontWeight: 600, color: '#1A2B3C' }}>
                    {test.questionSetId?.name || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                  <span style={{ color: '#6b7280' }}>Duration</span>
                  <span style={{ fontWeight: 600, color: '#1A2B3C' }}>{test.durationMinutes} Minutes</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                  <span style={{ color: '#6b7280' }}>Total Questions</span>
                  <span style={{ fontWeight: 600, color: '#1A2B3C' }}>{test.totalQuestions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                  <span style={{ color: '#6b7280' }}>Start Window</span>
                  <span style={{ fontWeight: 600, color: '#1A2B3C' }}>{test.startTestWindowMinutes} Minutes</span>
                </div>
                {test.supportedLanguages?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: 8 }}>
                    <span style={{ color: '#6b7280' }}>Languages</span>
                    <span style={{ fontWeight: 600, color: '#1A2B3C' }}>
                      {test.supportedLanguages.join(', ').toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <span style={{ color: '#6b7280', display: 'block', marginBottom: 6 }}>Instructions:</span>
                  <div
                    style={{
                      background: '#f9fafb',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      whiteSpace: 'pre-line',
                      color: '#374151',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    {test.instructions}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Physical Test Rooms Management (Section 9.3, 11.3) */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Physical Rooms ({rooms.length})</h3>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                  Generate secure room codes &amp; passwords for physical test centers.
                </p>
              </div>
              <button
                onClick={() => setShowAddRoomModal(true)}
                className="btn btn-primary"
                style={{ padding: '8px 14px', fontSize: '0.8rem' }}
              >
                + Add Room
              </button>
            </div>

            {rooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏢</div>
                <h4 style={{ color: '#1A2B3C', marginBottom: 4 }}>No rooms added yet</h4>
                <p style={{ fontSize: '0.85rem', marginBottom: 16 }}>
                  Add physical test rooms to generate unique Room Codes and Passwords for candidates.
                </p>
                <button
                  onClick={() => setShowAddRoomModal(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem' }}
                >
                  + Add First Room
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {rooms.map((room) => {
                  const isExpired = new Date(room.passwordValidUntil) < new Date();
                  const isClosed = room.status === 'CLOSED';

                  return (
                    <div
                      key={room._id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: 16,
                        background: isClosed ? '#f9fafb' : 'white',
                        opacity: isClosed ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <strong style={{ fontSize: '1rem', color: '#1A2B3C' }}>{room.roomName}</strong>
                          {room.capacity && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>
                              (Cap: {room.capacity})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span
                            className={`badge ${isClosed ? 'badge-danger' : 'badge-success'}`}
                            style={{ fontSize: '0.7rem' }}
                          >
                            {room.status}
                          </span>
                          {isExpired && !isClosed && (
                            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                              Password Expired
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Credentials Box */}
                      <div
                        style={{
                          background: '#F7F9FA',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 12,
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                            Room Code
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <code style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0E7C86' }}>
                              {room.roomCode}
                            </code>
                            <button
                              onClick={() => copyToClipboard(room.roomCode, 'Room Code')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                              title="Copy Code"
                            >
                              📋
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600 }}>
                            Room Password
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <code style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A2B3C' }}>
                              {room.roomPassword}
                            </code>
                            <button
                              onClick={() => copyToClipboard(room.roomPassword, 'Room Password')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                              title="Copy Password"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expiry Timestamp */}
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 12 }}>
                        Valid Until: {new Date(room.passwordValidUntil).toLocaleTimeString()} (
                        {new Date(room.passwordValidUntil).toLocaleDateString()})
                      </div>

                      {/* Action Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <button
                          onClick={() => {
                            const details = `Globussoft Test: ${test.title}\nRoom: ${room.roomName}\nRoom Code: ${room.roomCode}\nPassword: ${room.roomPassword}\nValid Until: ${new Date(room.passwordValidUntil).toLocaleTimeString()}`;
                            copyToClipboard(details, 'Room Invite Credentials');
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                        >
                          📋 Copy Full Invite
                        </button>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleViewRoomCandidates(room)}
                            className="btn btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          >
                            👥 Candidates
                          </button>
                          {!isClosed && (
                            <button
                              onClick={() => handleDeleteRoom(room._id, room.roomName)}
                              className="btn btn-danger"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              title="Close Room (FR-3.2)"
                            >
                              Close Room
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Start Test Modal ── */}
        {showStartModal && (
          <div className="modal-backdrop" onClick={() => !starting && setShowStartModal(false)}>
            <div className="modal-container" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Start Test (Go LIVE)</h3>
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: '#374151', fontSize: '0.9rem', marginBottom: 12 }}>
                  Are you ready to make <strong>"{test.title}"</strong> LIVE?
                </p>
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#92400e' }}>
                  ⚠️ Candidates with valid room codes will be able to join and start their proctored test session immediately.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowStartModal(false)}
                  className="btn btn-secondary"
                  disabled={starting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartTest}
                  className="btn btn-primary"
                  style={{ background: '#2ECC71' }}
                  disabled={starting}
                >
                  {starting ? 'Starting...' : 'Confirm & Start Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── End Test Modal ── */}
        {showEndModal && (
          <div className="modal-backdrop" onClick={() => !ending && setShowEndModal(false)}>
            <div className="modal-container" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title" style={{ color: '#E74C3C' }}>End Test</h3>
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: '#374151', fontSize: '0.9rem', marginBottom: 12 }}>
                  Are you sure you want to end <strong>"{test.title}"</strong>?
                </p>
                <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: 12, fontSize: '0.8rem', color: '#991b1b' }}>
                  ⚠️ Ending the test will broadcast a <code>test:ended</code> event to all candidate browsers, forcing immediate auto-submission and triggering the final evaluation pass.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEndModal(false)}
                  className="btn btn-secondary"
                  disabled={ending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEndTest}
                  className="btn btn-danger"
                  disabled={ending}
                >
                  {ending ? 'Ending...' : 'Confirm & End Test'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add Room Modal (FR-3.1) ── */}
        {showAddRoomModal && (
          <div className="modal-backdrop" onClick={() => !addingRoom && setShowAddRoomModal(false)}>
            <div className="modal-container" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Add Physical Room</h3>
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAddRoomSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Room Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Lab 201 — Ground Floor"
                      value={roomFormData.roomName}
                      onChange={(e) => setRoomFormData((p) => ({ ...p, roomName: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Room Capacity (Optional)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      placeholder="e.g. 50"
                      value={roomFormData.capacity}
                      onChange={(e) => setRoomFormData((p) => ({ ...p, capacity: e.target.value }))}
                    />
                  </div>

                  <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    💡 A cryptographic 6-character Room Code and Password will be automatically generated.
                  </p>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowAddRoomModal(false)}
                    className="btn btn-secondary"
                    disabled={addingRoom}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addingRoom}
                  >
                    {addingRoom ? 'Creating Room...' : 'Create Room'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Room Candidates Modal ── */}
        {selectedRoomCandidates && (
          <div className="modal-backdrop" onClick={() => setSelectedRoomCandidates(null)}>
            <div className="modal-container" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">
                  Candidates in {selectedRoomCandidates.room.roomName}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedRoomCandidates(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {loadingCandidates ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                    <div className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
                  </div>
                ) : selectedRoomCandidates.list.length === 0 ? (
                  <p style={{ color: '#6b7280', textAlign: 'center', padding: 24 }}>
                    No candidates have joined this room yet.
                  </p>
                ) : (
                  <table className="table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Candidate Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRoomCandidates.list.map((c) => (
                        <tr key={c._id}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td style={{ color: '#4b5563' }}>{c.email}</td>
                          <td style={{ color: '#6b7280' }}>{c.phone || '—'}</td>
                          <td>
                            {c.isDisqualified ? (
                              <span className="badge badge-danger">Disqualified</span>
                            ) : (
                              <span className="badge badge-success">Active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setSelectedRoomCandidates(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
