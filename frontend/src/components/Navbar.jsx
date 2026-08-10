import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export default function Navbar() {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      setUserRole(res.data?.role || 'user');
    }).catch(() => {});
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    window.location.href = '/login';
  };

  return (
    <nav className="w-full px-6 sm:px-8 py-4 backdrop-blur-xl bg-black/80 border-b border-neutral-800/80 sticky top-0 z-50 flex justify-between items-center shadow-2xl">
      <div className="flex items-center gap-3">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-3 group" aria-label="Interview.ai home">
          {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-extrabold text-white shadow-lg shadow-indigo-500/25 text-sm group-hover:scale-105 transition-transform">
            AI
          </div> */}
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300 tracking-tight">
            Interview.AI
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        {isAuthenticated ? (
          <>
            {userRole === 'admin' && (
              <Link to="/admin" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Admin Panel
              </Link>
            )}
            <Link to="/pricing" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg hover:bg-indigo-500/20">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Buy Credits
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-900"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            {location.pathname !== '/login' && (
              <Link
                to="/login"
                className="text-sm font-medium text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-neutral-900/80 transition-colors"
              >
                Log in
              </Link>
            )}
            {location.pathname !== '/register' && (
              <Link
                to="/register"
                className="text-sm py-2 px-5 font-bold"
              >
                Get Started
              </Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
