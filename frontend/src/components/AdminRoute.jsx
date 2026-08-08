import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export default function AdminRoute({ children }) {
  const [isAdmin, setIsAdmin] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setIsAdmin(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data && data.role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Admin Auth Check Failed:', err);
        setIsAdmin(false);
      }
    };

    checkAdmin();
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b] text-neutral-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold">Verifying Admin Credentials…</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
