import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SetupInterview from './pages/SetupInterview';
import InterviewRoom from './pages/InterviewRoom';
import InterviewResults from './pages/InterviewResults';
import Pricing from './pages/Pricing';
import AdminDashboard from './pages/AdminDashboard';
import AdminRoute from './components/AdminRoute';

import { API_BASE_URL } from './api';

function AppRoutes() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;
  const isInterviewRoom = /^\/interview\/[^/]+$/.test(location.pathname);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUserRole(res.data?.role || 'user');
    }).catch(() => {});
  }, [token]);

  if (isInterviewRoom) {
    return (
      <Routes>
        <Route path="/interview/:id" element={isAuthenticated ? <InterviewRoom /> : <Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white">
      <nav className="w-full px-8 py-4 backdrop-blur-md bg-neutral-950/60 border-b border-neutral-800 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">AI</div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight">Interview.ai</h1>
          </Link>
        </div>
        {isAuthenticated && (
          <div className="flex items-center gap-6">
            {userRole === 'admin' && (
              <Link to="/admin" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Admin Panel
              </Link>
            )}
            <Link to="/pricing" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Buy Credits
            </Link>
            <button
              onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Log out
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10 flex flex-col">
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/register" element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/setup" element={isAuthenticated ? <SetupInterview /> : <Navigate to="/login" />} />
          <Route path="/pricing" element={isAuthenticated ? <Pricing /> : <Navigate to="/login" />} />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/interview/:id/results" element={isAuthenticated ? <InterviewResults /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
