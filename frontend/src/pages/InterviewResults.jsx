import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

// ── Score helpers ─────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 8) return 'text-emerald-400';
  if (s >= 6) return 'text-amber-400';
  return 'text-rose-400';
}
function scoreBorder(s) {
  if (s >= 8) return 'border-emerald-500/40';
  if (s >= 6) return 'border-amber-500/40';
  return 'border-rose-500/40';
}
function scoreBg(s) {
  if (s >= 8) return 'bg-emerald-500/10';
  if (s >= 6) return 'bg-amber-500/10';
  return 'bg-rose-500/10';
}
function scoreLabel(s) {
  if (s >= 8) return 'Strong';
  if (s >= 6) return 'Good';
  if (s >= 4) return 'Fair';
  return 'Needs Work';
}

function ScoreRing({ score, max = 10, size = 120 }) {
  const r = 46;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / max) * circ;
  const color = score >= 8 ? '#10b981' : score >= 6 ? '#f59e0b' : score >= 4 ? '#f97316' : '#f43f5e';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#27272a" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="50" y="45" textAnchor="middle" fill="white" fontSize="22" fontWeight="900" fontFamily="sans-serif">{score}</text>
      <text x="50" y="62" textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="sans-serif">/ {max}</text>
    </svg>
  );
}

function ScoreBadge({ score }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${scoreBg(score)} ${scoreBorder(score)} ${scoreColor(score)}`}>
      {score}/10 · {scoreLabel(score)}
    </span>
  );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function Shimmer({ className = '' }) {
  return <div className={`bg-neutral-800/60 rounded-lg animate-pulse ${className}`} />;
}

export default function InterviewResults() {
  const { id } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [waitingForAnalysis, setWaitingForAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState('transcript');
  const [expanded, setExpanded]   = useState({});
  const pollRef = useRef(null);

  const fetchInterview = async () => {
    const { data } = await axios.get(`${API_BASE_URL}/api/interview/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return data.find(i => i._id === id) || null;
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const iv = await fetchInterview();
        if (cancelled) return;

        if (iv && iv.overallScore) {
          // Analysis already done — show immediately
          setInterview(iv);
          setLoading(false);
        } else if (iv) {
          // Interview exists but analysis not ready yet — poll
          setInterview(iv);
          setLoading(false);
          setWaitingForAnalysis(true);
          startPolling();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const startPolling = () => {
      pollRef.current = setInterval(async () => {
        if (cancelled) return;
        try {
          const iv = await fetchInterview();
          if (iv && iv.overallScore) {
            setInterview(iv);
            setWaitingForAnalysis(false);
            clearInterval(pollRef.current);
          }
        } catch (_) {}
      }, 3000);
    };

    init();
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id]);

  const toggleExpand = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="text-center text-neutral-400 mt-24 flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      Loading results…
    </div>
  );

  if (!interview) return (
    <div className="text-center text-neutral-500 mt-24 flex flex-col items-center gap-4">
      <p className="text-sm">Interview not found.</p>
      <Link to="/dashboard" className="text-indigo-400 text-sm hover:underline">← Dashboard</Link>
    </div>
  );

  // ── Waiting for analysis to finish ────────────────────────────────────────
  if (waitingForAnalysis) return (
    <div className="max-w-3xl mx-auto w-full relative z-10 py-20 px-4">
      <div className="glass-panel rounded-2xl p-10 flex flex-col items-center text-center gap-6">
        <div className="relative w-16 h-16">
          <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white mb-2">Generating Your Analysis</h2>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
            Alex is reviewing your interview responses, scoring each answer, and writing personalized
            improvements. This usually takes 10–20 seconds.
          </p>
        </div>
        {/* Skeleton preview */}
        <div className="w-full space-y-3 mt-2">
          <Shimmer className="h-4 w-3/4 mx-auto" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-5/6 mx-auto" />
          <Shimmer className="h-4 w-4/5 mx-auto" />
        </div>
        <p className="text-[11px] text-neutral-600">Checking every 3 seconds…</p>
      </div>
    </div>
  );

  // ── No results yet (shouldn't happen after polling, but guard) ────────────
  if (!interview.overallScore) return (
    <div className="text-center text-neutral-500 mt-24 flex flex-col items-center gap-4">
      <p className="text-sm">Results not yet available.</p>
      <Link to="/dashboard" className="text-indigo-400 text-sm hover:underline">← Dashboard</Link>
    </div>
  );

  // ── Data ready ────────────────────────────────────────────────────────────
  const aiMessages   = interview.messages.filter(m => m.role === 'ai');
  const userMessages = interview.messages.filter(m => m.role === 'user');

  const conversationPairs = aiMessages.map((aiMsg, idx) => ({
    ai       : aiMsg,
    user     : userMessages[idx] || null,
    breakdown: interview.questionBreakdown?.[idx] || null,
    qNum     : idx + 1,
  }));

  const avgQuestionScore = userMessages.filter(m => m.score).length
    ? (userMessages.filter(m => m.score).reduce((a, m) => a + m.score, 0) /
       userMessages.filter(m => m.score).length).toFixed(1)
    : null;

  const typeIcon = { Technical: '⚙️', HR: '🤝', Behavioral: '💬', 'System Design': '🏗️', Coding: '💻' };

  return (
    <div className="max-w-5xl mx-auto w-full relative z-10 pb-16">

      {/* ── Page header ── */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-2 text-xs text-neutral-500 mb-3">
          <Link to="/dashboard" className="hover:text-neutral-300 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-neutral-300">Interview Results</span>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {interview.experienceLevel} {interview.jobRole}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm">{typeIcon[interview.type] || '🎤'}</span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300">
                {interview.type}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                interview.difficulty === 'Hard'     ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                interview.difficulty === 'Easy'     ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                interview.difficulty === 'Adaptive' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {interview.difficulty}
              </span>
              <span className="text-xs text-neutral-500">
                {new Date(interview.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={async () => {
                try {
                  const res = await axios.get(`${API_BASE_URL}/api/pdf/download/${id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                    responseType: 'blob'
                  });
                  const url  = window.URL.createObjectURL(new Blob([res.data]));
                  const link = document.createElement('a');
                  link.href  = url;
                  link.setAttribute('download', `Interview_Report_${id}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.parentNode.removeChild(link);
                } catch { alert('Failed to download PDF'); }
              }}
              className="btn-primary py-2.5 px-5 text-sm rounded-xl"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PDF
            </button>
            <Link to="/dashboard" className="btn-secondary py-2.5 px-5 text-sm rounded-xl">
              ← Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* ── Score summary row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 stagger-children">
        {[
          { label: 'Overall Score',   value: `${interview.overallScore}/10`, color: scoreColor(interview.overallScore) },
          { label: 'Avg Q Score',     value: avgQuestionScore ? `${avgQuestionScore}/10` : '—', color: avgQuestionScore ? scoreColor(parseFloat(avgQuestionScore)) : 'text-neutral-500' },
          { label: 'Questions Asked', value: aiMessages.length,   color: 'text-indigo-400' },
          { label: 'Answers Given',   value: userMessages.length, color: 'text-indigo-400' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel rounded-2xl p-4 text-center">
            <div className={`text-2xl font-black tabular-nums ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 p-1 bg-neutral-900/60 rounded-xl mb-6 w-fit border border-neutral-800/50">
        {[
          { id: 'transcript', label: '💬 Full Transcript' },
          { id: 'breakdown',  label: '📋 Q&A Breakdown'  },
          { id: 'summary',    label: '📊 Summary Report'  },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow' : 'text-neutral-500 hover:text-neutral-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — FULL TRANSCRIPT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'transcript' && (
        <div className="space-y-3 animate-fade-up">
          <p className="text-xs text-neutral-500 mb-5">
            Complete conversation — every question Alex asked and every answer you gave, in order.
          </p>

          {conversationPairs.map(({ ai, user, qNum, breakdown }) => (
            <div key={qNum} className="space-y-3">

              {/* Alex's question bubble */}
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden border-2 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100"
                    alt="Alex" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-emerald-400">Alex</span>
                    <span className="text-[10px] text-neutral-600 font-semibold uppercase tracking-wider">Question {qNum}</span>
                  </div>
                  <div className="bg-neutral-800/60 border border-neutral-700/50 rounded-2xl rounded-tl-sm px-5 py-3.5 max-w-3xl">
                    <p className="text-sm text-neutral-200 leading-relaxed">{ai.content}</p>
                  </div>
                </div>
              </div>

              {/* Candidate answer + improved answer */}
              {user && (
                <div className="flex items-start gap-3 flex-row-reverse">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-600/30 border-2 border-indigo-500/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 flex flex-col items-end gap-2">
                    {/* Score + label */}
                    <div className="flex items-center gap-2">
                      {user.score && <ScoreBadge score={user.score} />}
                      <span className="text-xs font-bold text-indigo-400">You</span>
                    </div>

                    {/* Your answer */}
                    <div className="bg-indigo-600/15 border border-indigo-500/20 rounded-2xl rounded-tr-sm px-5 py-3.5 max-w-3xl w-full">
                      <p className="text-sm text-neutral-200 leading-relaxed">{user.content}</p>
                    </div>

                    {/* ✦ Improved answer — always visible directly below */}
                    {breakdown?.improvedAnswer && (
                      <div className="w-full max-w-3xl p-4 rounded-2xl rounded-tr-sm bg-violet-500/10 border border-violet-500/25">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">✦ Suggested Improvement</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 font-semibold">
                            How you could have said it
                          </span>
                        </div>
                        <p className="text-sm text-violet-100 leading-relaxed">{breakdown.improvedAnswer}</p>
                      </div>
                    )}

                    {/* Evaluator notes + model answer — collapsible */}
                    {(user.feedback || breakdown?.idealAnswer) && (
                      <>
                        <button onClick={() => toggleExpand(`t-${qNum}`)}
                          className="text-[10px] font-semibold text-neutral-500 hover:text-indigo-400 transition-colors flex items-center gap-1">
                          {expanded[`t-${qNum}`] ? '▾ Hide evaluator notes' : '▸ Show evaluator notes & model answer'}
                        </button>
                        {expanded[`t-${qNum}`] && (
                          <div className="w-full max-w-3xl space-y-3 animate-fade-up">
                            {user.feedback && (
                              <div className="p-4 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Alex's Evaluation</p>
                                <p className="text-xs text-neutral-300 leading-relaxed">{user.feedback}</p>
                              </div>
                            )}
                            {breakdown?.idealAnswer && (
                              <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1.5">★ Model / Ideal Answer</p>
                                <p className="text-xs text-neutral-300 leading-relaxed">{breakdown.idealAnswer}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {qNum < conversationPairs.length && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 h-px bg-neutral-800/60" />
                  <span className="text-[10px] text-neutral-700 font-semibold uppercase tracking-widest">Q{qNum + 1}</span>
                  <div className="flex-1 h-px bg-neutral-800/60" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — Q&A BREAKDOWN
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'breakdown' && (
        <div className="space-y-5 animate-fade-up">
          <p className="text-xs text-neutral-500 mb-5">
            Every question, your answer, a suggested improvement, the ideal answer, and evaluator feedback.
          </p>
          {conversationPairs.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl text-center text-neutral-500 text-sm">No conversation data available.</div>
          ) : conversationPairs.map(({ ai, user, breakdown, qNum }) => (
            <div key={qNum} className="glass-panel rounded-2xl overflow-hidden">

              {/* Header row — click to expand */}
              <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-neutral-800/30 transition-colors"
                onClick={() => toggleExpand(`b-${qNum}`)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 ${
                    user?.score ? `${scoreBg(user.score)} ${scoreBorder(user.score)} ${scoreColor(user.score)}` : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                  }`}>{qNum}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{ai.content}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      Question {qNum}{user?.score ? ` · ${user.score}/10 — ${scoreLabel(user.score)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {user?.score && (
                    <div className={`text-xl font-black tabular-nums ${scoreColor(user.score)}`}>
                      {user.score}<span className="text-xs text-neutral-600 font-normal">/10</span>
                    </div>
                  )}
                  <svg className={`w-4 h-4 text-neutral-500 transition-transform ${expanded[`b-${qNum}`] ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded body */}
              {expanded[`b-${qNum}`] && (
                <div className="border-t border-neutral-800/60 p-6 space-y-5 animate-fade-up">

                  {/* Question */}
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">Q</span>
                      Alex Asked
                    </p>
                    <div className="pl-4 border-l-2 border-emerald-500/30">
                      <p className="text-sm text-neutral-200 leading-relaxed">{ai.content}</p>
                    </div>
                  </div>

                  {/* Your answer + improved answer */}
                  {user && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400">A</span>
                        Your Answer
                      </p>
                      <div className="pl-4 border-l-2 border-indigo-500/30">
                        <p className="text-sm text-neutral-300 leading-relaxed italic">"{user.content}"</p>
                      </div>

                      {/* Improved answer directly below */}
                      {breakdown?.improvedAnswer && (
                        <div className="ml-4 p-4 rounded-xl bg-violet-500/10 border-l-2 border-violet-500/50 border border-violet-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">✦ Suggested Improvement</span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 font-semibold">
                              Rewritten from your response
                            </span>
                          </div>
                          <p className="text-sm text-violet-100 leading-relaxed">{breakdown.improvedAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ideal answer */}
                  {breakdown?.idealAnswer && (
                    <div className="p-4 rounded-xl bg-emerald-500/6 border border-emerald-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">★ Model / Ideal Answer</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">Benchmark</span>
                      </div>
                      <p className="text-sm text-neutral-200 leading-relaxed">{breakdown.idealAnswer}</p>
                    </div>
                  )}

                  {/* Evaluator feedback */}
                  {(user?.feedback || breakdown?.detailedFeedback) && (
                    <div className="p-4 rounded-xl bg-indigo-500/6 border border-indigo-500/20">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">📝 Evaluator Feedback</p>
                      <p className="text-sm text-neutral-300 leading-relaxed">{breakdown?.detailedFeedback || user?.feedback}</p>
                    </div>
                  )}

                  {/* Score bar */}
                  {user?.score && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider w-20 shrink-0">Score</span>
                      <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${
                          user.score >= 8 ? 'bg-emerald-500' : user.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} style={{ width: `${(user.score / 10) * 100}%` }} />
                      </div>
                      <span className={`text-sm font-black tabular-nums w-12 text-right ${scoreColor(user.score)}`}>{user.score}/10</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — SUMMARY REPORT
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-fade-up">
          <div className="glass-panel rounded-2xl p-7 grid grid-cols-1 md:grid-cols-4 gap-7 items-center">
            <div className="flex flex-col items-center gap-2 md:col-span-1">
              <ScoreRing score={interview.overallScore} />
              <span className={`text-xs font-black uppercase tracking-widest ${scoreColor(interview.overallScore)}`}>
                {scoreLabel(interview.overallScore)}
              </span>
            </div>
            <div className="md:col-span-3">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">📊 Interview Summary</p>
              <p className="text-sm text-neutral-300 leading-7 border-l-2 border-indigo-500/30 pl-4">
                {interview.comprehensiveFeedback || 'No summary available.'}
              </p>
            </div>
          </div>

          {/* Growth Analysis Competency Graph */}
          <div className="glass-panel rounded-2xl p-7">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Candidate Growth & Competency Radar
                </h3>
                <p className="text-xs text-neutral-400 mt-1">Multi-dimensional evaluation across key discussion topics.</p>
              </div>
            </div>

            <div className="space-y-5">
              {[
                { label: 'Communication & Articulation', score: interview.communicationScore || interview.overallScore || 7.5, icon: '🗣️', color: 'from-blue-500 to-indigo-500' },
                { label: 'Technical Depth & Mechanics',  score: interview.technicalScore || interview.overallScore || 7.5,     icon: '⚙️', color: 'from-indigo-500 to-purple-500' },
                { label: 'Problem Solving & Reasoning',   score: interview.problemSolvingScore || interview.overallScore || 7.5, icon: '💡', color: 'from-purple-500 to-pink-500' },
                { label: 'Architecture & System Design',  score: interview.architectureScore || interview.overallScore || 7.5,   icon: '🏗️', color: 'from-emerald-500 to-teal-500' },
                { label: 'Behavioral STAR Evidence',     score: interview.behavioralScore || interview.overallScore || 7.5,    icon: '🌟', color: 'from-amber-500 to-orange-500' },
              ].map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-200 flex items-center gap-2">
                      <span>{s.icon}</span>
                      {s.label}
                    </span>
                    <span className={`font-black tabular-nums ${scoreColor(s.score)}`}>{s.score}/10</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">✓</span>Key Strengths
              </h3>
              <ul className="space-y-3">
                {interview.strengths?.length > 0 ? interview.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[9px] font-black">{i + 1}</span>
                    <span className="text-sm text-neutral-300 leading-relaxed">{s}</span>
                  </li>
                )) : <li className="text-xs text-neutral-600">None identified.</li>}
              </ul>
            </div>
            <div className="glass-panel rounded-2xl p-6">
              <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center">↗</span>Growth Areas
              </h3>
              <ul className="space-y-3">
                {interview.growthAreas?.length > 0 ? interview.growthAreas.map((g, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-1 shrink-0 w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-[9px] font-black">{i + 1}</span>
                    <span className="text-sm text-neutral-300 leading-relaxed">{g}</span>
                  </li>
                )) : <li className="text-xs text-neutral-600">None identified.</li>}
              </ul>
            </div>
          </div>

          {conversationPairs.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-800/60">
                <h3 className="text-sm font-bold text-white">Question-by-Question Scores</h3>
                <p className="text-xs text-neutral-500 mt-0.5">At-a-glance score for each answer</p>
              </div>
              <div className="divide-y divide-neutral-800/40">
                {conversationPairs.map(({ ai, user, qNum }) => (
                  <div key={qNum} className="flex items-center gap-4 px-6 py-3.5 hover:bg-neutral-800/20 transition-colors">
                    <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border ${
                      user?.score ? `${scoreBg(user.score)} ${scoreBorder(user.score)} ${scoreColor(user.score)}` : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                    }`}>{qNum}</span>
                    <p className="flex-1 text-sm text-neutral-300 truncate">{ai.content}</p>
                    {user?.score ? (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden hidden sm:block">
                          <div className={`h-full rounded-full ${user.score >= 8 ? 'bg-emerald-500' : user.score >= 6 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${user.score * 10}%` }} />
                        </div>
                        <span className={`text-sm font-black ${scoreColor(user.score)} w-10 text-right`}>{user.score}/10</span>
                      </div>
                    ) : <span className="text-xs text-neutral-600 shrink-0">No score</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
