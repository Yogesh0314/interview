import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/register`, { name, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-10">
      <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-[#09090b]/90 border border-neutral-800 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-4 shadow-lg shadow-indigo-500/10">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Create an account</h2>
          <p className="text-neutral-400 text-sm">Start practicing interviews with AI today</p>
        </div>
        
        {error && <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-sm font-medium">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Full Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="glass-input w-full px-4 py-3 rounded-xl"
              placeholder="John Doe"
            />
          </div>
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
            Create Account
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-400">
          Already have an account? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
