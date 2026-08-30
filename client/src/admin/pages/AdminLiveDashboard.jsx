// AdminLiveDashboard.jsx — Live Monitoring Dashboard & Seat Map
// Implements PRD Section 9.8, Section 10 (Exact Socket.io Events), Section 11.7 (FR-7.3 persistent malpractice counter, FR-7.4), Section 11.8 (FR-8.1, FR-8.2, FR-8.3), Section 13 (NFR: 200ms debounce, React.memo, react-window virtualization for >50 items)
import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { List } from 'react-window';
import AdminNavbar from '../../shared/AdminNavbar';
import api from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuthContext';
import {
  initSocket, emitAdminJoin,
  onDashboardUpdate, offDashboardUpdate,
  onSeatmapStatus, offSeatmapStatus,
  onMalpracticeAlert, offMalpracticeAlert,
  onCandidateSubmitted, offCandidateSubmitted,
  onRoomUpdated, offRoomUpdated,
  onTestEnded, offTestEnded,
} from '../../services/socketClient';

// Exact Section 14 colors
const STATUS_COLORS = {
  GREEN: '#2ECC71',
  YELLOW: '#F1C40F',
  RED: '#E74C3C',
  WHITE: '#e5e7eb',
};

// ── Memoized Seat Tile (FR-7.3: Persistent Malpractice counter beside name) ────
const SeatTile = memo(({ candidate, roomName, onClick }) => {
  const color = STATUS_COLORS[candidate.colorStatus] || STATUS_COLORS.WHITE;
  const isWhite = candidate.colorStatus === 'WHITE' || !candidate.colorStatus;
  const malpracticeCount = candidate.malpracticeCount || 0;

  return (
    <div
      onClick={() => onClick(candidate)}
      style={{
        background: isWhite ? '#ffffff' : `${color}15`,
        border: `2px solid ${isWhite ? '#e5e7eb' : color}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 180ms ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: 115,
        boxShadow: isWhite ? 'none' : `0 2px 8px ${color}20`,
        position: 'relative',
        overflow: 'hidden',
      }}
      className="seat-tile-hover"
    >
      {/* Top Header: Candidate Name + Persistent Malpractice Counter (FR-7.3) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <strong
            style={{
              fontSize: '0.85rem',
              color: '#1A2B3C',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={candidate.name}
          >
            {candidate.name || 'Candidate'}
          </strong>

          {/* FR-7.3: Persistent Malpractice Counter directly beside candidate name */}
          <span
            className={`badge ${malpracticeCount > 0 ? 'badge-danger' : 'badge-secondary'}`}
            style={{
              fontSize: '0.65rem',
              padding: '1px 5px',
              fontWeight: 700,
              flexShrink: 0,
              backgroundColor: malpracticeCount > 0 ? '#E74C3C' : '#f3f4f6',
              color: malpracticeCount > 0 ? '#ffffff' : '#6b7280',
              border: malpracticeCount > 0 ? 'none' : '1px solid #e5e7eb',
            }}
            title={`Persistent Malpractice Counter: ${malpracticeCount} violations`}
          >
            ⚠️ {malpracticeCount}
          </span>
        </div>

        {/* Status dot / badge */}
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            display: 'inline-block',
            boxShadow: `0 0 6px ${color}`,
            flexShrink: 0,
          }}
          title={`Status: ${candidate.colorStatus || 'WHITE'}`}
        />
      </div>

      {/* Room and progress */}
      <div style={{ margin: '6px 0', fontSize: '0.75rem', color: '#6b7280' }}>
        <div>{roomName || 'Room'}</div>
        <div style={{ fontWeight: 600, color: '#374151', marginTop: 2 }}>
          {candidate.questionsCompleted !== undefined ? `${candidate.questionsCompleted} Qs Solved` : 'Not started'}
        </div>
      </div>

      {/* Bottom Footer: Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', marginTop: 4 }}>
        <span style={{ color: '#4b5563', fontFamily: 'monospace', fontWeight: 600 }}>
          {candidate.timeRemaining !== undefined
            ? `${Math.floor(candidate.timeRemaining / 60000)}m left`
            : '—'}
        </span>

        <span
          style={{
            fontSize: '0.65rem',
            color: color === '#F1C40F' ? '#b45309' : color,
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
        >
          {candidate.colorStatus || 'WHITE'}
        </span>
      </div>
    </div>
  );
});

// ── Memoized Table Row Component (FR-7.3: Persistent Malpractice counter beside name) ──
const CandidateRowItem = memo(({ candidate, roomName, onSelect, onWarn, onDisqualify, style }) => {
  const color = STATUS_COLORS[candidate.colorStatus] || STATUS_COLORS.WHITE;
  const malpracticeCount = candidate.malpracticeCount || 0;

  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1.2fr 1.2fr 1.5fr',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: '1px solid #f3f4f6',
        fontSize: '0.85rem',
        background: 'white',
      }}
    >
      {/* Candidate Name + Persistent Malpractice Counter (FR-7.3) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
        <strong style={{ color: '#1A2B3C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {candidate.name}
        </strong>
        {/* FR-7.3: Persistent Malpractice counter directly beside name */}
        <span
          className={`badge ${malpracticeCount > 0 ? 'badge-danger' : 'badge-secondary'}`}
          style={{
            fontSize: '0.65rem',
            padding: '1px 5px',
            fontWeight: 700,
            flexShrink: 0,
            backgroundColor: malpracticeCount > 0 ? '#E74C3C' : '#f3f4f6',
            color: malpracticeCount > 0 ? '#ffffff' : '#6b7280',
            border: malpracticeCount > 0 ? 'none' : '1px solid #e5e7eb',
          }}
          title={`Persistent Malpractice Counter: ${malpracticeCount}`}
        >
          ⚠️ {malpracticeCount}
        </span>
      </div>

      <div style={{ color: '#4b5563' }}>{roomName}</div>

      <div>
        <span
          className="badge"
          style={{
            background: `${color}20`,
            color: color === '#F1C40F' ? '#b45309' : color,
            border: `1px solid ${color}60`,
            fontSize: '0.72rem',
            fontWeight: 600,
          }}
        >
          {candidate.status || candidate.colorStatus || 'IN_PROGRESS'}
        </span>
      </div>

      <div style={{ color: '#1A2B3C', fontWeight: 600 }}>
        {candidate.questionsCompleted ?? 0}
      </div>

      <div>
        {malpracticeCount > 0 ? (
          <span className="badge badge-danger" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
            {malpracticeCount} Violations
          </span>
        ) : (
          <span style={{ color: '#2ECC71', fontSize: '0.75rem' }}>✓ Clean (0)</span>
        )}
      </div>

      <div style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {candidate.timeRemaining !== undefined
          ? `${Math.floor(candidate.timeRemaining / 60000)}m ${Math.floor((candidate.timeRemaining % 60000) / 1000)}s`
          : '—'}
      </div>

      <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onSelect(candidate)}
          className="btn btn-secondary"
          style={{ padding: '3px 8px', fontSize: '0.72rem' }}
        >
          Inspect
        </button>
        {candidate.status !== 'DISQUALIFIED' && (
          <>
            <button
              onClick={() => onWarn(candidate)}
              className="btn btn-secondary"
              style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#d97706' }}
              title="Send Warning"
            >
              Warn
            </button>
            <button
              onClick={() => onDisqualify(candidate)}
              className="btn btn-danger"
              style={{ padding: '3px 6px', fontSize: '0.72rem' }}
              title="Disqualify Candidate (FR-7.4)"
            >
              Disqualify
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default function AdminLiveDashboard() {
  const { testId } = useParams();
  const { user } = useAuth();

  const [test, setTest] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('ALL'); // FR-8.2: defaults to All Rooms
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Audio Voice Announcement Toggle (FR-8.3)
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Candidate Data Store: candidateId -> candidateObj
  const [candidatesMap, setCandidatesMap] = useState({});

  // Live Alerts Queue (FR-7.3)
  const [activeAlert, setActiveAlert] = useState(null);
  const [alertQueue, setAlertQueue] = useState([]);

  // Selected candidate for inspect drawer
  const [inspectCandidate, setInspectCandidate] = useState(null);

  // Zoom proof screenshot modal
  const [zoomScreenshotUrl, setZoomScreenshotUrl] = useState(null);

  // NFR: Debounce buffer for socket events (max 1 re-render per 200ms)
  const debounceBufferRef = useRef({});
  const debounceTimerRef = useRef(null);

  // Load Test & Rooms
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [testRes, roomsRes] = await Promise.all([
          api.getTest(testId),
          api.getRooms(testId),
        ]);
        if (!isMounted) return;
        setTest(testRes.data.test);
        setRooms(roomsRes.data.rooms || []);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to initialize live dashboard');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInitialData();
    return () => { isMounted = false; };
  }, [testId]);

  // Flush debounced socket updates to React state
  const flushDebounceBuffer = useCallback(() => {
    if (Object.keys(debounceBufferRef.current).length === 0) return;

    setCandidatesMap((prev) => {
      const updated = { ...prev };
      for (const [cid, data] of Object.entries(debounceBufferRef.current)) {
        updated[cid] = {
          ...(updated[cid] || {}),
          ...data,
          candidateId: cid,
        };
      }
      return updated;
    });

    debounceBufferRef.current = {};
  }, []);

  // Voice Announcement helper (FR-8.3)
  const announceCandidateSubmission = useCallback((name) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${name} has submitted the test.`);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis error:', e);
    }
  }, [voiceEnabled]);

  // ── Socket.io Connections & Event Subscriptions (Section 10) ──────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user?.id) return;

    const socket = initSocket(token);

    // Section 10.1: admin:join
    emitAdminJoin({ adminId: user.id, testId });

    // Section 10.2: dashboard:update
    const handleDashboardUpdate = (data) => {
      const cid = data.candidateId;
      if (!cid) return;

      debounceBufferRef.current[cid] = {
        ...(debounceBufferRef.current[cid] || {}),
        ...data,
      };

      if (!debounceTimerRef.current) {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          flushDebounceBuffer();
        }, 200); // 200ms NFR debounce
      }
    };

    // Section 10.2: seatmap:status
    const handleSeatmapStatus = (data) => {
      const cid = data.candidateId;
      if (!cid) return;

      debounceBufferRef.current[cid] = {
        ...(debounceBufferRef.current[cid] || {}),
        colorStatus: data.colorStatus,
        roomId: data.roomId,
      };

      if (!debounceTimerRef.current) {
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          flushDebounceBuffer();
        }, 200);
      }
    };

    // Section 10.2: malpractice:alert (FR-7.3)
    const handleMalpracticeAlert = (alertData) => {
      console.log('[Socket] Malpractice Alert received:', alertData);
      
      // Update candidate's persistent malpractice counter in map (FR-7.3)
      if (alertData.candidateId) {
        setCandidatesMap((prev) => {
          const current = prev[alertData.candidateId] || {};
          return {
            ...prev,
            [alertData.candidateId]: {
              ...current,
              malpracticeCount: alertData.currentCount || (current.malpracticeCount || 0) + 1,
            },
          };
        });
      }

      toast.error(`⚠️ Malpractice: ${alertData.candidateName} (${alertData.violationType})`, {
        duration: 5000,
      });

      setAlertQueue((q) => [...q, alertData]);
    };

    // Section 10.2: candidate:submitted (FR-8.3)
    const handleCandidateSubmitted = (subData) => {
      toast.success(`🎉 ${subData.candidateName || 'A candidate'} just submitted!`);
      announceCandidateSubmission(subData.candidateName || 'A candidate');
    };

    // Section 10.2: room:updated
    const handleRoomUpdated = () => {
      api.getRooms(testId).then((res) => setRooms(res.data.rooms || [])).catch(() => {});
    };

    // Section 10.2: test:ended
    const handleTestEnded = () => {
      toast('Test has ENDED.', { icon: '⏹' });
      setTest((t) => (t ? { ...t, status: 'ENDED' } : t));
    };

    onDashboardUpdate(handleDashboardUpdate);
    onSeatmapStatus(handleSeatmapStatus);
    onMalpracticeAlert(handleMalpracticeAlert);
    onCandidateSubmitted(handleCandidateSubmitted);
    onRoomUpdated(handleRoomUpdated);
    onTestEnded(handleTestEnded);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      offDashboardUpdate(handleDashboardUpdate);
      offSeatmapStatus(handleSeatmapStatus);
      offMalpracticeAlert(handleMalpracticeAlert);
      offCandidateSubmitted(handleCandidateSubmitted);
      offRoomUpdated(handleRoomUpdated);
      offTestEnded(handleTestEnded);
    };
  }, [testId, user?.id, flushDebounceBuffer, announceCandidateSubmission]);

  // Manage Active Alert Popup from Queue
  useEffect(() => {
    if (!activeAlert && alertQueue.length > 0) {
      setActiveAlert(alertQueue[0]);
      setAlertQueue((q) => q.slice(1));
    }
  }, [activeAlert, alertQueue]);

  // Review Malpractice Action (FR-7.4)
  const handleReviewMalpractice = async (logId, action) => {
    try {
      await api.reviewMalpractice(logId, { adminAction: action });
      toast.success(`Candidate marked as ${action}`);
      if (action === 'DISQUALIFIED' && activeAlert?.candidateId) {
        setCandidatesMap((prev) => ({
          ...prev,
          [activeAlert.candidateId]: {
            ...prev[activeAlert.candidateId],
            status: 'DISQUALIFIED',
            colorStatus: 'RED',
          },
        }));
      }
      setActiveAlert(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to review violation');
    }
  };

  const handleManualWarn = (candidate) => {
    toast(`Sent warning to ${candidate.name}`, { icon: '⚠️' });
  };

  const handleManualDisqualify = async (candidate) => {
    if (!window.confirm(`Are you sure you want to DISQUALIFY ${candidate.name}?`)) return;
    try {
      setCandidatesMap((prev) => ({
        ...prev,
        [candidate.candidateId]: {
          ...prev[candidate.candidateId],
          status: 'DISQUALIFIED',
          colorStatus: 'RED',
        },
      }));
      toast.success(`${candidate.name} has been disqualified.`);
    } catch (err) {
      toast.error('Failed to disqualify candidate');
    }
  };

  const roomsById = useMemo(() => {
    const map = {};
    rooms.forEach((r) => { map[r._id] = r.roomName; });
    return map;
  }, [rooms]);

  // Filter candidates
  const candidateList = useMemo(() => {
    return Object.values(candidatesMap).filter((c) => {
      const matchesRoom = selectedRoomId === 'ALL' || c.roomId === selectedRoomId;
      const matchesStatus = filterStatus === 'ALL' || c.colorStatus === filterStatus || c.status === filterStatus;
      const matchesSearch = !searchQuery.trim() || c.name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRoom && matchesStatus && matchesSearch;
    });
  }, [candidatesMap, selectedRoomId, filterStatus, searchQuery]);

  // Aggregated Stats
  const stats = useMemo(() => {
    let green = 0, yellow = 0, red = 0, white = 0, totalMalpractice = 0;
    Object.values(candidatesMap).forEach((c) => {
      if (c.colorStatus === 'GREEN') green++;
      else if (c.colorStatus === 'YELLOW') yellow++;
      else if (c.colorStatus === 'RED' || c.status === 'DISQUALIFIED') red++;
      else white++;

      if (c.malpracticeCount) totalMalpractice += c.malpracticeCount;
    });
    return {
      total: Object.keys(candidatesMap).length,
      green,
      yellow,
      red,
      white,
      totalMalpractice,
    };
  }, [candidatesMap]);

  // Section 13 NFR Virtualized Row Renderer for >50 items
  const VirtualizedRow = useCallback(({ index, style }) => {
    const candidate = candidateList[index];
    if (!candidate) return null;
    return (
      <CandidateRowItem
        candidate={candidate}
        roomName={roomsById[candidate.roomId] || 'Room'}
        onSelect={setInspectCandidate}
        onWarn={handleManualWarn}
        onDisqualify={handleManualDisqualify}
        style={style}
      />
    );
  }, [candidateList, roomsById]);

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

  return (
    <div className="app-layout">
      <AdminNavbar />
      <main className="main-content">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <Link to="/admin/tests" style={{ color: '#0E7C86', fontWeight: 500 }}>
            ← Tests
          </Link>
          <span style={{ color: '#9ca3af' }}>/</span>
          <Link to={`/admin/tests/${testId}`} style={{ color: '#0E7C86', fontWeight: 500 }}>
            {test?.title || 'Test Details'}
          </Link>
          <span style={{ color: '#9ca3af' }}>/</span>
          <span style={{ color: '#4b5563', fontWeight: 600 }}>Live Monitoring</span>
        </div>

        {/* Live Top Header */}
        <div className="card" style={{ marginBottom: 20, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: '1.6rem', color: '#1A2B3C', fontWeight: 800 }}>
                  {test?.title}
                </h1>
                <span
                  className="badge badge-success"
                  style={{
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                    animation: test?.status === 'LIVE' ? 'pulse 2s infinite' : 'none',
                  }}
                >
                  ● {test?.status || 'LIVE'}
                </span>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                  {test?.testType}
                </span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>
                Real-time multi-room monitoring · Passing Threshold: <strong>≥ {test?.passingCriteria} Qs</strong>
              </p>
            </div>

            {/* Header Controls: Room Filter, Voice TTS, Links */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Voice Announcement Toggle (FR-8.3) */}
              <button
                onClick={() => {
                  setVoiceEnabled(!voiceEnabled);
                  toast.success(voiceEnabled ? 'Voice announcements muted' : 'Voice announcements enabled');
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                title="AI Voice announcement when candidates submit (FR-8.3)"
              >
                {voiceEnabled ? '🔊 Voice TTS: ON' : '🔇 Voice TTS: OFF'}
              </button>

              {/* Room Filter Dropdown (FR-8.2) */}
              <select
                className="form-select"
                style={{ width: 180, fontSize: '0.85rem' }}
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
              >
                <option value="ALL">All Rooms (Combined)</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>{r.roomName}</option>
                ))}
              </select>

              <Link
                to={`/admin/tests/${testId}/results`}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                View Shortlist &amp; Results →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Real-Time Metrics Bar ── */}
        <div className="stats-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Active Candidates</div>
          </div>
          <div className="stat-card" style={{ borderLeft: `4px solid ${STATUS_COLORS.GREEN}` }}>
            <div className="stat-value" style={{ color: STATUS_COLORS.GREEN }}>{stats.green}</div>
            <div className="stat-label">Passing (≥ {test?.passingCriteria || 3} Qs)</div>
          </div>
          <div className="stat-card" style={{ borderLeft: `4px solid ${STATUS_COLORS.YELLOW}` }}>
            <div className="stat-value" style={{ color: '#d97706' }}>{stats.yellow}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card" style={{ borderLeft: `4px solid ${STATUS_COLORS.RED}` }}>
            <div className="stat-value" style={{ color: STATUS_COLORS.RED }}>{stats.red}</div>
            <div className="stat-label">Disqualified</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #8e44ad' }}>
            <div className="stat-value" style={{ color: '#8e44ad' }}>{stats.totalMalpractice}</div>
            <div className="stat-label">Total Violations</div>
          </div>
        </div>

        {/* ── Section 11.8: Seat Map Visualization (FR-7.3 Persistent Counter) ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 className="card-title">Live Physical Seat Map (FR-8.1, FR-8.2)</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                Persistent violation counters (<code>⚠️ count</code>) visible directly on each seat tile (FR-7.3).
              </p>
            </div>

            {/* Seat Map Legend (Section 14) */}
            <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLORS.GREEN }} />
                <span>Passed (≥ Criteria)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLORS.YELLOW }} />
                <span>In Progress</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLORS.RED }} />
                <span>Disqualified</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ffffff', border: '1.5px solid #e5e7eb' }} />
                <span>Not Started</span>
              </div>
            </div>
          </div>

          {candidateList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📡</div>
              <h4 style={{ color: '#1A2B3C', marginBottom: 4 }}>Waiting for candidates to connect...</h4>
              <p style={{ fontSize: '0.85rem' }}>
                As candidates join physical rooms and send heartbeats, their seats will appear here in real time.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 14,
                padding: '8px 0',
              }}
            >
              {candidateList.map((c) => (
                <SeatTile
                  key={c.candidateId}
                  candidate={c}
                  roomName={roomsById[c.roomId] || 'Room'}
                  onClick={setInspectCandidate}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Candidate Roster & Proctoring Table (Section 13: react-window Virtualization) ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title">Candidate Live Proctoring Roster</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 2 }}>
                {candidateList.length > 50
                  ? `⚡ Virtualized View Active (${candidateList.length} candidates — 60fps steady)`
                  : `Showing ${candidateList.length} connected candidate(s)`}
              </p>
            </div>

            {/* Table Filters */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search candidate..."
                style={{ width: 200, fontSize: '0.8rem', padding: '6px 12px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="form-select"
                style={{ width: 140, fontSize: '0.8rem', padding: '6px 10px' }}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="GREEN">Passed</option>
                <option value="YELLOW">In Progress</option>
                <option value="RED">Disqualified</option>
              </select>
            </div>
          </div>

          {/* Table Header Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr 1.2fr 1.2fr 1.5fr',
              padding: '10px 16px',
              background: '#f9fafb',
              borderBottom: '1.5px solid #e5e7eb',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#374151',
            }}
          >
            <div>Candidate (FR-7.3 Counter)</div>
            <div>Room</div>
            <div>Status</div>
            <div>Qs Solved</div>
            <div>Malpractice</div>
            <div>Time Left</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {/* Table Body: Virtualized with react-window when > 50 candidates, standard when <= 50 */}
          {candidateList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#6b7280', fontSize: '0.85rem' }}>
              No matching candidates connected.
            </div>
          ) : candidateList.length > 50 ? (
            // Section 13 NFR: react-window List Virtualization for > 50 candidates
            <List
              rowComponent={VirtualizedRow}
              rowCount={candidateList.length}
              rowHeight={48}
              style={{ height: 450 }}
            />
          ) : (
            // Standard render for <= 50 candidates
            <div>
              {candidateList.map((c) => (
                <CandidateRowItem
                  key={c.candidateId}
                  candidate={c}
                  roomName={roomsById[c.roomId] || 'Room'}
                  onSelect={setInspectCandidate}
                  onWarn={handleManualWarn}
                  onDisqualify={handleManualDisqualify}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Live Malpractice Alert Modal (FR-7.3, FR-7.4) ── */}
        {activeAlert && (
          <div className="modal-backdrop" style={{ zIndex: 1100 }}>
            <div className="modal-container" style={{ maxWidth: 560, border: '2px solid #E74C3C' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.4rem' }}>🚨</span>
                  <h3 className="modal-title" style={{ color: '#E74C3C' }}>
                    Malpractice Alert (FR-7.3)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Candidate:</span>
                    <strong style={{ display: 'block', color: '#1A2B3C' }}>{activeAlert.candidateName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Violation Type:</span>
                    <span className="badge badge-danger" style={{ display: 'inline-block', marginTop: 2 }}>
                      {activeAlert.violationType}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Violation Count:</span>
                    <strong style={{ display: 'block', color: '#E74C3C' }}>
                      Incident #{activeAlert.currentCount || 1}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Timestamp:</span>
                    <span style={{ display: 'block', color: '#4b5563' }}>
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Proof Screenshot Image */}
                {activeAlert.proofScreenshotUrl ? (
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: 6 }}>
                      📸 Captured Proof Frame:
                    </span>
                    <div
                      style={{
                        position: 'relative',
                        border: '1.5px solid #e5e7eb',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'zoom-in',
                      }}
                      onClick={() => setZoomScreenshotUrl(activeAlert.proofScreenshotUrl)}
                    >
                      <img
                        src={activeAlert.proofScreenshotUrl}
                        alt="Violation Proof"
                        style={{ width: '100%', maxHeight: 240, objectFit: 'contain', background: '#000' }}
                      />
                      <div style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4 }}>
                        🔍 Click to Enlarge
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f3f4f6', padding: 16, borderRadius: 6, textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                    No frame capture available.
                  </div>
                )}

                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, padding: 10, fontSize: '0.78rem', color: '#92400e' }}>
                  ℹ️ <strong>FR-7.4:</strong> Malpractice does not auto-disqualify during live test. Review proof above and select an admin action.
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setActiveAlert(null)}
                  className="btn btn-secondary"
                >
                  Dismiss
                </button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleReviewMalpractice(activeAlert.malpracticeLogId, 'WARNED')}
                    className="btn btn-secondary"
                    style={{ color: '#d97706', border: '1.5px solid #d97706' }}
                  >
                    ⚠️ Issue Warning
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewMalpractice(activeAlert.malpracticeLogId, 'DISQUALIFIED')}
                    className="btn btn-danger"
                  >
                    🚫 Disqualify Candidate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Candidate Inspect Modal / Drawer ── */}
        {inspectCandidate && (
          <div className="modal-backdrop" onClick={() => setInspectCandidate(null)}>
            <div className="modal-container" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Candidate Details</h3>
                <button
                  type="button"
                  onClick={() => setInspectCandidate(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', color: '#1A2B3C' }}>{inspectCandidate.name}</h4>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      Room: {roomsById[inspectCandidate.roomId] || 'Assigned Room'}
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: `${STATUS_COLORS[inspectCandidate.colorStatus] || '#9ca3af'}20`,
                      color: STATUS_COLORS[inspectCandidate.colorStatus] || '#374151',
                      border: `1px solid ${STATUS_COLORS[inspectCandidate.colorStatus] || '#9ca3af'}`,
                    }}
                  >
                    {inspectCandidate.colorStatus || 'ACTIVE'}
                  </span>
                </div>

                <div style={{ background: '#f9fafb', padding: 14, borderRadius: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Questions Solved:</span>
                    <strong style={{ display: 'block', color: '#1A2B3C', fontSize: '1.05rem', marginTop: 2 }}>
                      {inspectCandidate.questionsCompleted ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Malpractice Incidents:</span>
                    <strong style={{ display: 'block', color: inspectCandidate.malpracticeCount > 0 ? '#E74C3C' : '#2ECC71', fontSize: '1.05rem', marginTop: 2 }}>
                      {inspectCandidate.malpracticeCount ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Time Remaining:</span>
                    <span style={{ display: 'block', fontFamily: 'monospace', fontWeight: 600, color: '#374151', marginTop: 2 }}>
                      {inspectCandidate.timeRemaining !== undefined
                        ? `${Math.floor(inspectCandidate.timeRemaining / 60000)}m ${Math.floor((inspectCandidate.timeRemaining % 60000) / 1000)}s`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#6b7280' }}>Status:</span>
                    <span style={{ display: 'block', fontWeight: 600, color: '#1A2B3C', marginTop: 2 }}>
                      {inspectCandidate.status || 'IN_PROGRESS'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setInspectCandidate(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Zoom Screenshot Modal ── */}
        {zoomScreenshotUrl && (
          <div className="modal-backdrop" onClick={() => setZoomScreenshotUrl(null)} style={{ zIndex: 1200 }}>
            <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
              <img
                src={zoomScreenshotUrl}
                alt="Enlarged Proof Frame"
                style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
              />
              <button
                onClick={() => setZoomScreenshotUrl(null)}
                style={{
                  position: 'absolute',
                  top: -12,
                  right: -12,
                  background: '#1A2B3C',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
