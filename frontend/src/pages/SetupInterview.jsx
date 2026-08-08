import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../api';

const JOB_ROLES = [
  'Software Engineer', 'Data Scientist', 'Product Manager', 'Product Designer',
  'Marketing Manager', 'Sales Executive', 'Financial Analyst', 'HR Professional',
  'Operations Manager', 'Consultant', 'DevOps Engineer', 'Machine Learning Engineer',
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
];

const INTERVIEW_TYPES = ['Technical', 'HR', 'Behavioral', 'System Design', 'Coding'];
const DIFFICULTIES    = ['Easy', 'Medium', 'Hard', 'Adaptive'];
const EXP_LEVELS      = ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead'];

// ── Helpers ──────────────────────────────────────────────────────────────────
const readinessConfig = {
  High     : { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: '✓' },
  Moderate : { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     icon: '~' },
  Low      : { color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/30',        icon: '!' },
};

const difficultyConfig = {
  Easy     : { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Medium   : { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  Hard     : { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30'    },
  Adaptive : { color: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30'  },
};

// SVG ring score component
function ScoreRing({ value, max = 100, size = 80, label, color = '#6366f1' }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke="#27272a" strokeWidth="7" />
        <circle
          cx="42" cy="42" r={r} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '42px 42px', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="42" y="47" textAnchor="middle" fill="white" fontSize="16" fontWeight="800" fontFamily="sans-serif">
          {value}
        </text>
      </svg>
      <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

// Section score bar
function SectionBar({ label, score }) {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-neutral-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
        {score}
      </span>
    </div>
  );
}

export default function SetupInterview() {
  const [file, setFile]                       = useState(null);
  const [rawText, setRawText]                 = useState('');
  const [jobDescription, setJobDescription]   = useState('');
  const [length, setLength]                   = useState('15');
  const [jobRole, setJobRole]                 = useState(JOB_ROLES[0]);
  const [experienceLevel, setExperienceLevel] = useState('Mid-Level');
  const [type, setType]                       = useState(INTERVIEW_TYPES[0]);
  const [difficulty, setDifficulty]           = useState(DIFFICULTIES[1]);

  const [credits, setCredits]                 = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [analyzing, setAnalyzing]             = useState(false);
  const [atsResult, setAtsResult]             = useState(null);
  const [validationError, setValidationError] = useState('');
  const [activeTab, setActiveTab]             = useState('resume'); // 'resume' | 'jd'
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (data.role === 'admin') {
          navigate('/admin');
          return;
        }
        setCredits(data.credits);
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };
    fetchCredits();
  }, [navigate]);

  const handleATSAnalyze = async () => {
    setValidationError('');
    if (!file && !rawText.trim()) {
      setValidationError('Please upload a PDF or paste your resume text first.');
      return;
    }
    setAnalyzing(true);
    setAtsResult(null);
    try {
      const formData = new FormData();
      if (file) formData.append('resumePdf', file);
      if (rawText) formData.append('rawText', rawText);
      formData.append('jobRole', jobRole);
      formData.append('jobDescription', jobDescription);
      formData.append('difficulty', difficulty);
      formData.append('experienceLevel', experienceLevel);

      const { data } = await axios.post(`${API_BASE_URL}/api/interview/ats-analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAtsResult(data);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setValidationError(`ATS analysis failed: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStart = async () => {
    setValidationError('');
    if (!file && !rawText.trim()) {
      setValidationError('Resume is required. Please upload a PDF or paste your resume text.');
      return;
    }
    if (credits <= 0) {
      setValidationError('You have 0 credits remaining. Please upgrade your plan.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      if (file) formData.append('resumePdf', file);
      if (rawText) formData.append('rawText', rawText);
      formData.append('jobDescription', jobDescription);
      formData.append('length', length);
      formData.append('jobRole', jobRole);
      formData.append('experienceLevel', experienceLevel);
      formData.append('type', type);
      formData.append('difficulty', difficulty);

      const { data } = await axios.post(`${API_BASE_URL}/api/interview/setup`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      navigate(`/interview/${data._id}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setValidationError(`Failed to setup interview: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const diffCfg = difficultyConfig[difficulty] || difficultyConfig.Medium;

  return (
    <div className="max-w-5xl mx-auto w-full relative z-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Configure Interview</h2>
          <p className="text-neutral-400 mt-1 text-sm">Set up a personalized AI interview session tailored to your target role.</p>
        </div>
        <div className="flex items-center gap-2 glass-panel px-4 py-2.5 rounded-full shrink-0">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
          <span className="text-sm font-bold text-neutral-200">
            {credits !== null ? `${credits} Credit${credits !== 1 ? 's' : ''}` : '…'}
          </span>
        </div>
      </div>

      {/* ── Validation Error ── */}
      {validationError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3 font-medium animate-fade-up text-sm">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {validationError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── LEFT: Setup Form (3/5) ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Target Role */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="section-label mb-4">Target Position</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Job Role</label>
                <select value={jobRole} onChange={e => setJobRole(e.target.value)}
                  className="w-full p-3 rounded-xl glass-input text-sm appearance-none cursor-pointer">
                  {JOB_ROLES.map(r => <option key={r} value={r} className="bg-neutral-900">{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Experience Level</label>
                <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full p-3 rounded-xl glass-input text-sm appearance-none cursor-pointer">
                  {EXP_LEVELS.map(l => <option key={l} value={l} className="bg-neutral-900">{l}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Interview Format */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="section-label mb-4">Interview Format</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className="w-full p-3 rounded-xl glass-input text-sm appearance-none cursor-pointer">
                  {INTERVIEW_TYPES.map(t => <option key={t} value={t} className="bg-neutral-900">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Difficulty</label>
                <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setAtsResult(null); }}
                  className="w-full p-3 rounded-xl glass-input text-sm appearance-none cursor-pointer">
                  {DIFFICULTIES.map(d => <option key={d} value={d} className="bg-neutral-900">{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-neutral-500 mb-1.5 block">Duration</label>
                <select value={length} onChange={e => setLength(e.target.value)}
                  className="w-full p-3 rounded-xl glass-input text-sm appearance-none cursor-pointer">
                  <option value="15" className="bg-neutral-900">15 min session</option>
                  <option value="30" className="bg-neutral-900">30 min session</option>
                  <option value="60" className="bg-neutral-900">60 min session</option>
                </select>
              </div>
            </div>
            {/* Session info badge */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border font-semibold ${diffCfg.bg} ${diffCfg.border} ${diffCfg.color}`}>
                <span>Difficulty:</span>
                <span>{difficulty}</span>
                {difficulty === 'Hard' && <span className="ml-1 opacity-70">— High bar</span>}
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{length === '15' ? '15 min (~2 min/Q)' : length === '30' ? '30 min (~2 min/Q)' : '60 min (~2.5 min/Q)'}</span>
              </div>
            </div>
          </div>

          {/* Resume + JD — Tabbed */}
          <div className="glass-panel p-6 rounded-2xl">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-neutral-950/60 rounded-xl mb-5 w-fit">
              {[{ id: 'resume', label: '📄 Resume' }, { id: 'jd', label: '📋 Job Description' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'resume' && (
              <div className="space-y-3 animate-fade-up">
                <h3 className="section-label mb-2">Provide Resume</h3>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all hover:bg-neutral-900/50 ${file ? 'border-indigo-500 bg-indigo-500/5' : 'border-neutral-700 bg-neutral-950/30'}`}>
                  <input type="file" accept=".pdf" className="hidden"
                    onChange={e => { if (e.target.files[0]) { setFile(e.target.files[0]); setRawText(''); } }} />
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${file ? 'bg-indigo-500/20 text-indigo-400' : 'bg-neutral-800 text-neutral-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  {file ? (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-indigo-400">{file.name}</p>
                      <p className="text-xs text-neutral-500 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-medium text-neutral-300">Drop your PDF here</p>
                      <p className="text-xs text-neutral-500 mt-1">or click to browse</p>
                    </div>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-neutral-900 px-3 text-xs text-neutral-600">or paste text</span>
                  </div>
                </div>
                <textarea
                  value={rawText}
                  onChange={e => { setRawText(e.target.value); setFile(null); }}
                  className="w-full p-3.5 rounded-xl glass-input resize-none h-32 text-sm"
                  placeholder="Paste your resume text here…"
                />
              </div>
            )}

            {activeTab === 'jd' && (
              <div className="animate-fade-up">
                <div className="flex items-start gap-3 mb-4 p-3.5 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                  <svg className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-indigo-300 mb-0.5">Why add a Job Description?</p>
                    <p className="text-xs text-neutral-400 leading-relaxed">The ATS score becomes significantly more accurate when your resume is compared against the actual JD — measuring real keyword overlap, required skills, and qualification match instead of generic role expectations.</p>
                  </div>
                </div>
                <h3 className="section-label mb-2">Paste Job Description</h3>
                <textarea
                  value={jobDescription}
                  onChange={e => { setJobDescription(e.target.value); setAtsResult(null); }}
                  className="w-full p-3.5 rounded-xl glass-input resize-none h-52 text-sm"
                  placeholder="Paste the full job description here — requirements, responsibilities, qualifications…"
                />
                {jobDescription.trim() && (
                  <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    JD added — ATS scoring will match against this specific posting
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleATSAnalyze}
              disabled={analyzing || (!file && !rawText.trim())}
              className="flex-1 glass-panel text-indigo-400 font-bold py-3 px-5 rounded-xl hover:bg-neutral-800/60 transition-all flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed text-sm border border-indigo-500/20 hover:border-indigo-500/40"
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  Analyzing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {jobDescription.trim() ? 'Analyze Resume vs JD' : 'Run ATS Analysis'}
                </>
              )}
            </button>
            <button
              onClick={handleStart}
              disabled={loading || credits <= 0}
              className="flex-1 btn-primary py-3 px-5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Setting up…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Interview
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── RIGHT: ATS Results Panel (2/5) ── */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 rounded-2xl sticky top-24">

            <div className="flex items-center justify-between mb-5">
              <h3 className="section-label">ATS Analysis</h3>
              {jobDescription.trim() && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  vs JD
                </span>
              )}
            </div>

            {!atsResult ? (
              <div className="text-center py-10 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-neutral-800/60 flex items-center justify-center">
                  <svg className="w-7 h-7 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  {jobDescription.trim()
                    ? 'Run ATS Analysis to see how your resume matches the job description'
                    : 'Add your resume and optionally a job description, then run the analysis'}
                </p>
                <div className="flex flex-col gap-2 text-xs text-neutral-600">
                  {[
                    'Resume vs JD keyword matching',
                    'Section-by-section scoring',
                    'Difficulty readiness check',
                  ].map((tip, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-neutral-700"></div>
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-fade-up">

                {/* Dual score rings */}
                <div className="flex justify-around py-2">
                  <ScoreRing
                    value={atsResult.atsScore}
                    label={jobDescription.trim() ? 'JD Match' : 'ATS Score'}
                    color="#6366f1"
                  />
                  <ScoreRing
                    value={atsResult.difficultyReadiness}
                    label={`${difficulty} Readiness`}
                    color={difficulty === 'Hard' ? '#f43f5e' : difficulty === 'Easy' ? '#10b981' : '#f59e0b'}
                  />
                </div>

                {/* Interview Readiness badge */}
                {atsResult.interviewReadiness && (() => {
                  const cfg = readinessConfig[atsResult.interviewReadiness] || readinessConfig.Moderate;
                  return (
                    <div className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border ${cfg.bg}`}>
                      <span className="text-xs font-semibold text-neutral-300">Interview Readiness</span>
                      <span className={`text-xs font-black ${cfg.color}`}>
                        {cfg.icon} {atsResult.interviewReadiness}
                      </span>
                    </div>
                  );
                })()}

                {/* Section scores */}
                {atsResult.sectionScores && (
                  <div>
                    <h4 className="section-label mb-3">Section Scores</h4>
                    <div className="space-y-2">
                      {Object.entries(atsResult.sectionScores).map(([key, val]) => (
                        <SectionBar key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} score={val} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                <div>
                  <h4 className="section-label mb-2">Keyword Matches</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {atsResult.keywordMatches?.map((kw, i) => (
                      <span key={i} className="keyword-chip bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                        ✓ {kw}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="section-label mb-2">Missing Keywords</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {atsResult.missingKeywords?.map((kw, i) => (
                      <span key={i} className="keyword-chip bg-rose-500/10 border-rose-500/30 text-rose-400">
                        ✗ {kw}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <h4 className="section-label mb-2 text-emerald-400/70">Strengths</h4>
                    <ul className="space-y-1.5">
                      {atsResult.strengths?.map((s, i) => (
                        <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5 shrink-0">▸</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="section-label mb-2 text-amber-400/70">Areas to Improve</h4>
                    <ul className="space-y-1.5">
                      {atsResult.weaknesses?.map((w, i) => (
                        <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5 shrink-0">▸</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Formatting tips */}
                {atsResult.formattingTips?.length > 0 && (
                  <div>
                    <h4 className="section-label mb-2 text-sky-400/70">Formatting Tips</h4>
                    <ul className="space-y-1.5">
                      {atsResult.formattingTips.map((t, i) => (
                        <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                          <span className="text-sky-400 mt-0.5 shrink-0">→</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                <div className="p-3.5 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Recommendation</p>
                  <p className="text-xs text-neutral-300 leading-relaxed italic">"{atsResult.recommendation}"</p>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
