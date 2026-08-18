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
import Navbar from './components/Navbar';
import Home from './pages/Home';

import { API_BASE_URL } from './api';

function AppRoutes() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;
  const isInterviewRoom = /^\/interview\/[^/]+$/.test(location.pathname);
  const isHomePage = location.pathname === '/';
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUserRole(res.data?.role || 'user');
    }).catch((err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        window.location.reload();
      }
    });
  }, [token]);

  if (isInterviewRoom) {
    return (
      <Routes>
        <Route path="/interview/:id" element={isAuthenticated ? <InterviewRoom /> : <Navigate to="/login" />} />
      </Routes>
    );
  }

  if (isHomePage && !isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10 flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
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
          <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/'} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="relative z-10">
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;
