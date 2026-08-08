import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';

// ── Helpers ───────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (!s) return 'text-neutral-500';
  if (s >= 8) return 'text-emerald-400';
  if (s >= 6) return 'text-amber-400';
  return 'text-rose-400';
}
function scoreBg(s) {
  if (!s) return 'bg-neutral-800 text-neutral-400 border-neutral-700';
  if (s >= 8) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (s >= 6) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
}

const phaseLabel = { warmup: 'Warm-up', core: 'Core', challenge: 'Challenge', closing: 'Closing' };
const typeIcon = {
  Technical: '⚙️', HR: '🤝', Behavioral: '💬', 'System Design': '🏗️', Coding: '💻'
};

// Animated stat card
function StatCard({ label, value, sub, icon, gradient, delay = 0 }) {
  return (
    <div
      className="stat-card"
      style={{ animationDelay: `${delay}ms`, opacity: 0, animation: `fade-up 0.5s ease-out ${delay}ms forwards` }}
    >
      <div className={`absolute inset-0 rounded-2xl opacity-5 ${gradient}`}></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="section-label">{label}</span>
          <span className="text-xl">{icon}</span>
        </div>
        <div className="text-3xl font-black text-white tabular-nums">{value}</div>
        {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// Mini score ring
function MiniRing({ score }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = score ? score / 10 : 0;
  const offset = circ - pct * circ;
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : score ? '#f43f5e' : '#404040';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '22px 22px' }} />
      <text x="22" y="26" textAnchor="middle" fill="white" fontSize="11" fontWeight="800" fontFamily="sans-serif">
        {score ? score : '–'}
      </text>
    </svg>
  );
}

// Custom tooltip for line chart
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-neutral-400 mb-1">{label}</p>
      <p className="text-indigo-400 font-bold">{payload[0].value}/10</p>
    </div>
  );
}

export default function Dashboard() {
  const [history, setHistory]   = useState([]);
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all'); // 'all' | 'completed' | 'ongoing'
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyRes, userRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/interview/history`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }),
          axios.get(`${API_BASE_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          })
        ]);
        setHistory(historyRes.data);
        setUser(userRes.data);
        if (userRes.data?.role === 'admin') {
          navigate('/admin');
        }
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  if (loading) return (
    <div className="text-center text-neutral-400 mt-20 flex items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      Loading your dashboard…
    </div>
  );

  // ── Computed stats ──────────────────────────────────────────────────────────
  const completed   = history.filter(i => i.status === 'completed');
  const scored      = completed.filter(i => i.overallScore);
  const avgScore    = scored.length ? (scored.reduce((a, b) => a + b.overallScore, 0) / scored.length).toFixed(1) : '—';
  const bestScore   = scored.length ? Math.max(...scored.map(i => i.overallScore)) : '—';
  const completionRate = history.length ? Math.round((completed.length / history.length) * 100) : 0;

  // Chart: last 10 scored sessions, chronological
  const chartData = scored
    .slice()
    .reverse()
    .slice(-10)
    .map(i => ({
      date: new Date(i.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      score: i.overallScore,
      role: i.jobRole,
    }));

  // Skills radar: derive from growthAreas frequency across all sessions
  const skillCounts = {};
  history.forEach(i => {
    (i.growthAreas || []).forEach(area => {
      skillCounts[area] = (skillCounts[area] || 0) + 1;
    });
  });
  // Top 6 growth areas → radar (inverse: more mentions = more growth needed = lower score)
  const radarData = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([area, count]) => ({
      skill: area.length > 12 ? area.slice(0, 12) + '…' : area,
      score: Math.max(2, 10 - count * 2)
    }));

  // Filtered history
  const filteredHistory = history.filter(i => {
    if (filter === 'completed') return i.status === 'completed';
    if (filter === 'ongoing')   return i.status === 'ongoing';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto w-full relative z-10 space-y-8 pb-12">

      {/* ── Hero Header ── */}
      <div
        className="glass-panel rounded-3xl p-7 relative overflow-hidden"
        style={{ animation: 'fade-up 0.4s ease-out forwards' }}
      >
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-600/8 rounded-full blur-[40px] pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
          <div>
            <p className="section-label mb-1">Welcome back</p>
            <h2 className="text-3xl font-black text-white tracking-tight">
              {user?.name || 'Candidate'} 👋
            </h2>
            <p className="text-neutral-400 mt-1.5 text-sm">
              You have{' '}
              <span className="text-indigo-400 font-bold">{user?.credits ?? '—'} credit{user?.credits !== 1 ? 's' : ''}</span>
              {' '}remaining · {history.length} session{history.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/setup" className="btn-primary py-2.5 px-5 text-sm rounded-xl">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Interview
            </Link>
            <button
              disabled
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-neutral-800/60 text-neutral-500 border border-neutral-700/50 cursor-not-allowed relative"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Resume Builder
              <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 uppercase tracking-wider">Soon</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard label="Total Sessions"   value={history.length}   icon="🎯" gradient="bg-gradient-to-br from-indigo-500 to-purple-600" delay={0} />
        <StatCard label="Avg Score"        value={avgScore}         icon="📊" gradient="bg-gradient-to-br from-amber-500 to-orange-600"  sub={scored.length ? `from ${scored.length} scored` : 'No scored sessions yet'} delay={80} />
        <StatCard label="Best Score"       value={bestScore}        icon="🏆" gradient="bg-gradient-to-br from-emerald-500 to-teal-600"   sub={bestScore !== '—' ? `out of 10` : '—'} delay={160} />
        <StatCard label="Completion Rate"  value={`${completionRate}%`} icon="✅" gradient="bg-gradient-to-br from-sky-500 to-cyan-600" sub={`${completed.length} of ${history.length} completed`} delay={240} />
      </div>

      {/* ── Charts Row ── */}
      {(chartData.length > 0 || radarData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Performance trend */}
          {chartData.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl lg:col-span-3">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-white">Performance Trend</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Score across your last {chartData.length} sessions</p>
                </div>
                <div className="text-2xl font-black text-indigo-400">{avgScore}<span className="text-sm text-neutral-600 font-medium">/10</span></div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} stroke="#52525b" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone" dataKey="score" stroke="url(#lineGrad)" strokeWidth={3}
                      dot={{ r: 5, fill: '#6366f1', stroke: '#09090b', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#a855f7' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Skills radar */}
          {radarData.length >= 3 && (
            <div className="glass-panel p-6 rounded-2xl lg:col-span-2">
              <div className="mb-4">
                <h3 className="text-base font-bold text-white">Growth Areas Radar</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Areas needing most attention</p>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Session History ── */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h3 className="text-xl font-bold text-white">Interview Sessions</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{history.length} session{history.length !== 1 ? 's' : ''} total</p>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-neutral-900/60 rounded-xl">
            {[['all', 'All'], ['completed', 'Completed'], ['ongoing', 'In Progress']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === val ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="glass-panel p-14 rounded-2xl text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-neutral-800/50 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-neutral-500 text-sm">
              {filter !== 'all' ? `No ${filter} sessions.` : 'No interviews yet.'}
            </p>
            {filter === 'all' && (
              <Link to="/setup" className="btn-primary py-2.5 px-6 text-sm rounded-xl">
                Start Your First Interview
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
            {filteredHistory.map((session, idx) => (
              <Link
                key={session._id}
                to={session.status === 'completed' ? `/interview/${session._id}/results` : `/interview/${session._id}`}
                className="glass-panel-hover p-5 rounded-2xl block group"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-base">{typeIcon[session.type] || '🎤'}</span>
                      <span className="text-xs font-bold text-neutral-400 px-2 py-0.5 rounded-md bg-neutral-800 border border-neutral-700">
                        {session.type}
                      </span>
                      {session.difficulty && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          session.difficulty === 'Hard'   ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          session.difficulty === 'Easy'   ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          session.difficulty === 'Adaptive' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {session.difficulty}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-neutral-200 group-hover:text-indigo-300 transition-colors truncate">
                      {session.experienceLevel} {session.jobRole}
                    </h4>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {new Date(session.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <MiniRing score={session.overallScore} />
                </div>

                {/* Growth areas */}
                {session.growthAreas?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {session.growthAreas.slice(0, 3).map((area, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/8 text-indigo-300 border border-indigo-500/15">
                        {area}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/60">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${session.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${session.status === 'completed' ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {session.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                  <span className="text-xs text-indigo-400 font-semibold group-hover:text-indigo-300 flex items-center gap-1">
                    {session.status === 'completed' ? 'View Results' : 'Continue'}
                    <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            to: '/setup',
            icon: '🎙️',
            title: 'New Interview',
            desc: 'Start a fresh AI-powered session',
            disabled: false,
            cta: 'Get Started →'
          },
          {
            to: null,
            icon: '📝',
            title: 'Resume Builder',
            desc: 'Build an ATS-optimized resume',
            disabled: true,
            cta: 'Coming Soon',
            badge: 'Soon'
          },
          {
            to: null,
            icon: '📈',
            title: 'All History',
            desc: `${history.length} sessions recorded`,
            disabled: false,
            onClick: () => setFilter('all'),
            cta: 'View All ↓'
          },
        ].map((action, i) => (
          action.to ? (
            <Link
              key={i}
              to={action.to}
              className="glass-panel-hover p-5 rounded-2xl flex items-start gap-4 group"
            >
              <div className="text-2xl w-10 h-10 flex items-center justify-center bg-neutral-800/60 rounded-xl shrink-0">
                {action.icon}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-0.5">{action.title}</h4>
                <p className="text-xs text-neutral-500 mb-2">{action.desc}</p>
                <span className="text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">{action.cta}</span>
              </div>
            </Link>
          ) : (
            <div
              key={i}
              onClick={action.onClick}
              className={`glass-panel p-5 rounded-2xl flex items-start gap-4 ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-neutral-700/70 transition-all'}`}
            >
              <div className="text-2xl w-10 h-10 flex items-center justify-center bg-neutral-800/60 rounded-xl shrink-0">
                {action.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-white">{action.title}</h4>
                  {action.badge && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 uppercase">{action.badge}</span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mb-2">{action.desc}</p>
                <span className="text-xs text-neutral-500 font-semibold">{action.cta}</span>
              </div>
            </div>
          )
        ))}
      </div>

    </div>
  );
}
