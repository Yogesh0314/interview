import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'analytics' | 'interviews'
  const [search, setSearch] = useState('');
  const [editingCreditUser, setEditingCreditUser] = useState(null);
  const [newCreditValue, setNewCreditValue] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('token');

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes, interviewsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/admin/users?search=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE_URL}/api/admin/interviews`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setInterviews(interviewsRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [search]);

  const handleQuickCreditAdd = async (userId, targetCredits) => {
    try {
      setActionLoading(true);
      const { data } = await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/credits`, 
        { credits: targetCredits },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, credits: data.credits } : u));
      setMessage(`Granted +5 credits to ${data.name}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Quick credit add failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCredits = async (userId) => {
    try {
      setActionLoading(true);
      const { data } = await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/credits`, 
        { credits: Number(newCreditValue) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, credits: data.credits } : u));
      setEditingCreditUser(null);
      setMessage(`Updated credits for ${data.name}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Credit update failed:', err);
      alert(err.response?.data?.message || 'Failed to update credits');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Are you sure you want to change ${user.name}'s role to ${newRole}?`)) return;

    try {
      setActionLoading(true);
      const { data } = await axios.put(`${API_BASE_URL}/api/admin/users/${user._id}/role`, 
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u._id === user._id ? { ...u, role: data.role } : u));
      setMessage(`Updated role for ${data.name} to ${data.role}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Role update failed:', err);
      alert(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user ${user.name} (${user.email})? This action cannot be undone.`)) return;

    try {
      setActionLoading(true);
      await axios.delete(`${API_BASE_URL}/api/admin/users/${user._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(prev => prev.filter(u => u._id !== user._id));
      setMessage(`Deleted user ${user.name}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Delete user failed:', err);
      alert(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-neutral-400">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold">Loading Admin Command Center…</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-10 relative z-10 space-y-8 font-sans">
      
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-wider">
              Admin Access Granted
            </span>
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3 mt-2">
            Admin Command Center
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Platform operations, user authorization, and growth analytics.</p>
        </div>

        {message && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold px-4 py-2 rounded-xl">
            {message}
          </div>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Total Users</div>
          <div className="text-4xl font-black text-white">{stats?.totalUsers || 0}</div>
          <div className="text-[11px] text-neutral-400 mt-2">{stats?.totalCreditsAllocated || 0} credits allocated</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Total Interviews</div>
          <div className="text-4xl font-black text-emerald-400">{stats?.totalInterviews || 0}</div>
          <div className="text-[11px] text-neutral-400 mt-2">{stats?.completedInterviews || 0} completed</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Avg Overall Score</div>
          <div className="text-4xl font-black text-amber-400">{stats?.growthAverages?.avgOverallScore || 7.5}/10</div>
          <div className="text-[11px] text-neutral-400 mt-2">Across candidate sessions</div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Est. Revenue</div>
          <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            ₹{(stats?.estimatedRevenue || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-neutral-400 mt-2">Platform subscriptions</div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex gap-2 p-1 bg-neutral-900/70 border border-neutral-800 rounded-xl w-fit">
        {[
          { id: 'users', label: '👥 User Management' },
          { id: 'analytics', label: '📊 Growth Analysis Radar' },
          { id: 'interviews', label: '🎥 Interview Logs' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === t.id
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: USER MANAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <input
              type="text"
              placeholder="Search user by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-xl text-xs w-full sm:w-80 focus:outline-none focus:border-rose-500"
            />
            <span className="text-xs text-neutral-500 self-center">Showing {users.length} registered users</span>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-900/80 border-b border-white/10 text-neutral-400 uppercase tracking-wider font-bold text-[10px]">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Credits</th>
                    <th className="p-4">Joined</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u._id} className="hover:bg-white/[0.02]">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{u.name}</div>
                        <div className="text-neutral-500 text-xs">{u.email}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                          u.role === 'admin'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-emerald-400 text-sm">{u.credits}</td>
                      <td className="p-4 text-neutral-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => handleQuickCreditAdd(u._id, u.credits + 5)}
                          disabled={actionLoading}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[11px] font-semibold border border-emerald-500/30 transition-colors"
                        >
                          +5 Credits
                        </button>
                        <button
                          onClick={() => { setEditingCreditUser(u); setNewCreditValue(u.credits); }}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[11px] font-semibold border border-neutral-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-amber-400 rounded-lg text-[11px] font-semibold border border-neutral-700"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-[11px] font-semibold border border-rose-500/30 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: GROWTH ANALYSIS RADAR ── */}
      {activeTab === 'analytics' && stats?.growthAverages && (
        <div className="space-y-6">
          <div className="glass-panel p-7 rounded-2xl space-y-6">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Platform Candidate Growth & Skill Radar Averages
            </h3>
            <p className="text-xs text-neutral-400">
              Aggregated candidate proficiency metrics across all evaluated platform interview sessions.
            </p>

            <div className="space-y-5">
              {[
                { label: 'Communication & Articulation', score: stats.growthAverages.avgCommunicationScore, icon: '🗣️', color: 'from-blue-500 to-indigo-500' },
                { label: 'Technical Depth & Mechanics',  score: stats.growthAverages.avgTechnicalScore,     icon: '⚙️', color: 'from-indigo-500 to-purple-500' },
                { label: 'Problem Solving & Reasoning',   score: stats.growthAverages.avgProblemSolvingScore, icon: '💡', color: 'from-purple-500 to-pink-500' },
                { label: 'Architecture & System Design',  score: stats.growthAverages.avgArchitectureScore,   icon: '🏗️', color: 'from-emerald-500 to-teal-500' },
                { label: 'Behavioral STAR Evidence',     score: stats.growthAverages.avgBehavioralScore,    icon: '🌟', color: 'from-amber-500 to-orange-500' },
              ].map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200 flex items-center gap-2">
                      <span>{s.icon}</span>
                      {s.label}
                    </span>
                    <span className="font-black text-rose-400 tabular-nums">{s.score}/10</span>
                  </div>
                  <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-1000`}
                      style={{ width: `${(s.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: INTERVIEW LOGS ── */}
      {activeTab === 'interviews' && (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-900/80 border-b border-white/10 text-neutral-400 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Role & Experience</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Overall Score</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {interviews.map(inv => (
                  <tr key={inv._id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="font-bold text-white">{inv.user?.name || 'Candidate'}</div>
                      <div className="text-neutral-500 text-[11px]">{inv.user?.email || '—'}</div>
                    </td>
                    <td className="p-4 font-semibold text-neutral-200">
                      {inv.experienceLevel} {inv.jobRole}
                    </td>
                    <td className="p-4 text-neutral-400">{inv.type}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300 text-[10px] font-bold">
                        {inv.difficulty}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 font-black text-sm text-indigo-400">
                      {inv.overallScore ? `${inv.overallScore}/10` : '—'}
                    </td>
                    <td className="p-4 text-neutral-500">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Credit Edit Modal ── */}
      {editingCreditUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#121215] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Adjust User Credits</h3>
            <p className="text-xs text-neutral-400">Updating credits for {editingCreditUser.name} ({editingCreditUser.email})</p>
            <input
              type="number"
              value={newCreditValue}
              onChange={(e) => setNewCreditValue(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 text-white px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none focus:border-rose-500"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setEditingCreditUser(null)}
                className="flex-1 py-2.5 bg-neutral-800 text-white rounded-xl text-xs font-semibold hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateCredits(editingCreditUser._id)}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-500"
              >
                Save Credits
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
