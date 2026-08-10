import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10">
      <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-[#09090b]/90 border border-neutral-800 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Welcome back</h2>
          <p className="text-neutral-400 text-sm">Sign in to access your interview practice sessions</p>
        </div>
        
        {error && <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-sm font-medium">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="glass-input w-full px-4 py-3 rounded-xl"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="glass-input w-full px-4 py-3 rounded-xl"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            className="btn-primary w-full py-3.5 px-4 font-bold text-base mt-2"
          >
            Sign In
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-400">
          Don't have an account? <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
