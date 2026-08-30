import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuthContext';
import './styles/global.css';

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
// Admin panel
const AdminLogin = lazy(() => import('./admin/pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./admin/pages/AdminDashboard'));
const AdminTests = lazy(() => import('./admin/pages/AdminTests'));
const AdminTestDetail = lazy(() => import('./admin/pages/AdminTestDetail'));
const AdminQuestionBank = lazy(() => import('./admin/pages/AdminQuestionBank'));
const AdminLiveDashboard = lazy(() => import('./admin/pages/AdminLiveDashboard'));
const AdminResults = lazy(() => import('./admin/pages/AdminResults'));
const AdminCreateAdmin = lazy(() => import('./admin/pages/AdminCreateAdmin'));

// Candidate panel
const CandidateRegister = lazy(() => import('./candidate/pages/CandidateRegister'));
const CandidateLogin = lazy(() => import('./candidate/pages/CandidateLogin'));
const CandidateJoinRoom = lazy(() => import('./candidate/pages/CandidateJoinRoom'));
const CandidateInstructions = lazy(() => import('./candidate/pages/CandidateInstructions'));
const CandidateTestScreen = lazy(() => import('./candidate/pages/CandidateTestScreen'));
const CandidateAITestScreen = lazy(() => import('./candidate/pages/CandidateAITestScreen'));
const CandidateTestComplete = lazy(() => import('./candidate/pages/CandidateTestComplete'));

// ── Route guards ──────────────────────────────────────────────────────────────
const RequireAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || user.type !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
};

const RequireCandidate = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || user.type !== 'candidate') return <Navigate to="/candidate/login" replace />;
  return children;
};

const RequireSuperAdmin = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user || user.role !== 'SUPER_ADMIN') return <Navigate to="/admin" replace />;
  return children;
};

const LoadingSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <div className="spinner spinner-dark" style={{ width: 40, height: 40, borderWidth: 3 }} />
  </div>
);

// ── App ───────────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* ── Admin Routes ── */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/tests" element={<RequireAdmin><AdminTests /></RequireAdmin>} />
        <Route path="/admin/tests/:testId" element={<RequireAdmin><AdminTestDetail /></RequireAdmin>} />
        <Route path="/admin/tests/:testId/live" element={<RequireAdmin><AdminLiveDashboard /></RequireAdmin>} />
        <Route path="/admin/tests/:testId/results" element={<RequireAdmin><AdminResults /></RequireAdmin>} />
        <Route path="/admin/question-bank" element={<RequireAdmin><AdminQuestionBank /></RequireAdmin>} />
        <Route
          path="/admin/create-admin"
          element={<RequireSuperAdmin><AdminCreateAdmin /></RequireSuperAdmin>}
        />

        {/* ── Candidate Routes ── */}
        <Route path="/candidate/register" element={<CandidateRegister />} />
        <Route path="/candidate/login" element={<CandidateLogin />} />
        <Route path="/candidate/join" element={<RequireCandidate><CandidateJoinRoom /></RequireCandidate>} />
        <Route path="/candidate/instructions" element={<RequireCandidate><CandidateInstructions /></RequireCandidate>} />
        <Route path="/candidate/test" element={<RequireCandidate><CandidateTestScreen /></RequireCandidate>} />
        <Route path="/candidate/ai-test" element={<RequireCandidate><CandidateAITestScreen /></RequireCandidate>} />
        <Route path="/candidate/complete" element={<RequireCandidate><CandidateTestComplete /></RequireCandidate>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        {/* React Hot Toast for notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '0.875rem',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
