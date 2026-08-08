import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { API_BASE_URL } from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// INTERVIEW PHASE STATE MACHINE
//
//  'ai_speaking'  → TTS is playing. Mic is LOCKED. No candidate interaction.
//  'listening'    → TTS finished. Mic is active. Candidate speaks.
//  'processing'   → Answer submitted. Waiting for backend. Mic LOCKED.
//  'idle'         → Before the interview starts.
// ─────────────────────────────────────────────────────────────────────────────

export default function InterviewRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview]       = useState(null);
  const [phase, setPhase]               = useState('idle');  // core state machine
  const [hasStarted, setHasStarted]     = useState(false);
  const [notice, setNotice]             = useState('');
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);

  const [liveTranscript, setLiveTranscript] = useState('');  // real-time speech text
  const [finalAnswer, setFinalAnswer]       = useState('');  // committed answer text
  const [code, setCode]                     = useState('// Write your code here...\n');
  const [loading, setLoading]               = useState(true);
  const [secondsRemaining, setSecondsRemaining] = useState(null);

  // Tracks whether the last AI message is a follow-up on same topic
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Web Speech APIs
  const recognitionRef    = useRef(null);
  const synthRef          = useRef(window.speechSynthesis);
  const silenceTimerRef   = useRef(null);
  const sessionTimerRef   = useRef(null);
  const isEndingRef       = useRef(false);

  // Refs for stale-closure safety
  const phaseRef          = useRef(phase);
  const finalAnswerRef    = useRef(finalAnswer);
  const interviewRef      = useRef(interview);
  const isCodingModeRef   = useRef(false);

  const displayAlert = (message) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  };

  const stopAllMedia = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    try { recognitionRef.current?.stop(); } catch (_) {}
    try { recognitionRef.current?.abort(); } catch (_) {}

    if (synthRef.current) synthRef.current.cancel();

  }, []);

  const finishForTimeLimit = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setPhase('processing');
    stopAllMedia();
    sessionStorage.removeItem(`interview:${id}:deadline`);

    try {
      if (synthRef.current) {
        synthRef.current.cancel();
        const msg = new SpeechSynthesisUtterance("Your session time is complete. Thank you for participating! Generating your feedback report now.");
        msg.rate = 0.95;
        synthRef.current.speak(msg);
      }
      axios.post(`${API_BASE_URL}/api/interview/finish`, { interviewId: id }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      }).catch(e => console.error('Finish error:', e));

      setTimeout(() => {
        stopAllMedia();
        navigate(`/interview/${id}/results`);
      }, 2500);
    } catch (error) {
      console.error('Time-limit finish error:', error);
      isEndingRef.current = false;
      displayAlert('Your time is up. We could not finish the interview—please try again.');
    }
  }, [id, navigate, stopAllMedia]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { finalAnswerRef.current = finalAnswer; }, [finalAnswer]);
  useEffect(() => { interviewRef.current = interview; }, [interview]);
  useEffect(() => {
    isCodingModeRef.current = interview && (interview.type === 'Coding' || interview.type === 'System Design');
  }, [interview]);

  useEffect(() => {
    if (!hasStarted || !interview) return;

    const storageKey = `interview:${id}:deadline`;
    const durationMs = (Number(interview.length) || 15) * 60 * 1000;
    let deadline = Number(sessionStorage.getItem(storageKey));
    if (!deadline) {
      deadline = Date.now() + durationMs;
      sessionStorage.setItem(storageKey, String(deadline));
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
        finishForTimeLimit();
      }
    };

    updateTimer();
    sessionTimerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [hasStarted, id, interview?.length, finishForTimeLimit]);

  // ───────────────────────────────────────────────────────────────────────────
  // General UI helpers
  // ───────────────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // Media cleanup
  // ───────────────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // Fetch Interview
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/interview/history`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const current = data.find(i => i._id === id);
        if (current) {
          setInterview(current);
          if (current.status === 'completed') navigate(`/interview/${id}/results`);
        }
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        } else {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [id, navigate]);

  // ───────────────────────────────────────────────────────────────────────────
  // Speech Recognition Setup
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SR();
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      // Only process if we're in listening phase
      if (phaseRef.current !== 'listening') return;

      let interim = '';
      let committed = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          committed += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (committed) {
        setFinalAnswer(prev => prev + (prev ? ' ' : '') + committed);
      }
      // Always show live feedback including interim
      setLiveTranscript(interim);

      // Reset silence timer on any speech activity (12-second pause limit)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        // Auto-submit on 12s silence, only when in listening phase
        if (phaseRef.current === 'listening') {
          const hasContent = finalAnswerRef.current.trim() || isCodingModeRef.current;
          if (hasContent) {
            triggerSubmit();
          }
        }
      }, 12000);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Speech recognition error:', e.error);
      }
    };

    // Auto-restart if it stops while we're still in listening phase
    recognition.onend = () => {
      if (phaseRef.current === 'listening') {
        try { recognition.start(); } catch (_) {}
      }
    };

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognition.stop();
      if (synthRef.current) synthRef.current.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // TTS — speak AI question and then transition to listening
  // ───────────────────────────────────────────────────────────────────────────
  const speakQuestion = useCallback((text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    setPhase('ai_speaking');

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.95;
    utterance.pitch = 1.0;

    // Pick a slightly warmer voice if available
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v => v.name.includes('Google UK English Male'))
      || voices.find(v => v.name.includes('Andrew'))
      || voices.find(v => v.lang === 'en-US' && v.localService);
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      // 700ms grace period after TTS ends before mic activates
      setTimeout(() => {
        setPhase('listening');
        setLiveTranscript('');
        try {
          if (recognitionRef.current) recognitionRef.current.start();
        } catch (_) {}
      }, 700);
    };

    utterance.onerror = () => {
      // On TTS error, still transition to listening so candidate isn't locked out
      setPhase('listening');
      setLiveTranscript('');
    };

    synthRef.current.speak(utterance);
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // Submit answer
  // ───────────────────────────────────────────────────────────────────────────
  const triggerSubmit = useCallback(async () => {
    const isCodingMode = isCodingModeRef.current;
    const currentAnswer = finalAnswerRef.current;

    if (!currentAnswer.trim() && !isCodingMode) return;
    if (phaseRef.current === 'processing') return; // prevent double-submit

    // Stop speech recognition & silence timer
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    try { recognitionRef.current?.stop(); } catch (_) {}
    if (synthRef.current) synthRef.current.cancel();

    setPhase('processing');
    setLiveTranscript('');

    const fullAnswer = isCodingMode
      ? `[User Code]:\n${code}\n\n[User Explanation]:\n${currentAnswer}`
      : currentAnswer;

    // Optimistic UI update
    setInterview(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: fullAnswer }]
    }));
    setFinalAnswer('');

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/interview/chat`, {
        interviewId: id,
        answer: fullAnswer
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      setInterview(data);

      // Detect follow-up flag from latest AI message
      const lastMsg = data.messages[data.messages.length - 1];
      if (lastMsg?.role === 'ai') {
        setIsFollowUp(lastMsg.followUpOnSameTopic ?? false);
      }

      if (data.status === 'completed') {
        sessionStorage.removeItem(`interview:${id}:deadline`);
        // Speak closing message
        if (lastMsg?.role === 'ai') {
          speakQuestion(lastMsg.content);
        }
        // Fire /finish analysis in background
        axios.post(`${API_BASE_URL}/api/interview/finish`, { interviewId: id }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).catch(e => console.error('Finish error:', e));

        // Allow closing TTS to finish speaking then navigate to results
        setTimeout(() => {
          stopAllMedia();
          navigate(`/interview/${id}/results`);
        }, 3500);
      } else {
        // Speak next AI question — will auto-transition to 'listening' on TTS end
        if (lastMsg?.role === 'ai') {
          speakQuestion(lastMsg.content);
        }
      }
    } catch (err) {
      console.error(err);
      displayAlert('Failed to send message. Please try again.');
      // Restore answer so candidate can retry
      setFinalAnswer(currentAnswer);
      setPhase('listening');
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  }, [code, id, navigate, speakQuestion, stopAllMedia]);

  // ───────────────────────────────────────────────────────────────────────────
  // Manual mic toggle (only functional in 'listening' phase)
  // ───────────────────────────────────────────────────────────────────────────
  const handleManualSubmit = () => {
    if (phaseRef.current !== 'listening') return;
    triggerSubmit();
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Start interview
  // ───────────────────────────────────────────────────────────────────────────
  const startInterview = () => {
    sessionStorage.removeItem(`interview:${id}:deadline`);
    isEndingRef.current = false;
    setHasStarted(true);
    const firstMsg = interview.messages[interview.messages.length - 1];
    if (firstMsg?.role === 'ai') {
      setTimeout(() => speakQuestion(firstMsg.content), 400);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // End call
  // ───────────────────────────────────────────────────────────────────────────
  const handleEndCall = () => {
    setShowConfirmEnd(true);
  };

  const confirmEndCall = () => {
    setShowConfirmEnd(false);
    stopAllMedia();
    navigate('/dashboard');
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Loading / Not found
  // ───────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="text-center text-white mt-20 flex items-center justify-center gap-3">
      <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      Connecting to Interview Room...
    </div>
  );
  if (!interview) return <div className="text-center text-white mt-20">Interview not found.</div>;

  // ───────────────────────────────────────────────────────────────────────────
  // Pre-interview setup screen
  // ───────────────────────────────────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <div className="fixed inset-0 h-screen w-screen bg-neutral-950 flex flex-col items-center justify-center text-center p-6 overflow-hidden">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ready to Begin?</h2>
          <p className="text-neutral-400 text-sm mb-8">
            This is a {interview.length}-minute session. The AI interviewer will ask questions aloud and listen to your responses.
          </p>
          <ul className="text-left space-y-3 mb-8">
            {[
              'Microphone Required',
              'AI speaks first — your mic activates automatically after each question',
              'Speak naturally — auto-submits after 12s of silence',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-neutral-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
          <button
            onClick={startInterview}
            className="w-full btn-primary py-3 rounded-xl font-bold tracking-wide"
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Derived state for UI
  // ───────────────────────────────────────────────────────────────────────────
  const currentTurn   = interview.messages.filter(m => m.role === 'ai').length;
  const lastAiMessage = [...interview.messages].reverse().find(m => m.role === 'ai')?.content || '';
  const isCodingMode  = interview.type === 'Coding' || interview.type === 'System Design';
  const isLocked      = phase === 'ai_speaking' || phase === 'processing';

  // Status display
  const statusMap = {
    ai_speaking : { text: 'Reecha is speaking…', color: 'text-emerald-400' },
    listening   : { text: 'Your turn — speak now', color: 'text-amber-400'   },
    processing  : { text: 'Processing answer…',  color: 'text-indigo-400'  },
    idle        : { text: 'Waiting',               color: 'text-neutral-500' },
  };
  const { text: statusText, color: statusColor } = statusMap[phase] || statusMap.idle;
  const timeRemainingLabel = secondsRemaining === null
    ? `${interview.length}:00`
    : `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`;

  // Phase badge mapping (6 realistic interview stages + legacy aliases)
  const phaseBadgeMap = {
    warmup              : { label: 'Warm-up',               bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30'           },
    opening             : { label: 'Warm-up',               bg: 'bg-sky-500/15 text-sky-400 border-sky-500/30'           },
    technical_skills    : { label: 'Technical Skills',      bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'         },
    internship_experience: { label: 'Internship & Experience', bg: 'bg-violet-500/15 text-violet-400 border-violet-500/30'   },
    projects            : { label: 'Project Architecture',  bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30'         },
    skills              : { label: 'Technical Skills',      bg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'         },
    technical_deep_dive : { label: 'Deep Technical',        bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'   },
    technical           : { label: 'Deep Technical',        bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'   },
    fundamentals_and_dsa: { label: 'Fundamentals / DSA',    bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30'     },
    fundamentals        : { label: 'Fundamentals / DSA',    bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30'     },
    behavioral          : { label: 'Behavioral',            bg: 'bg-pink-500/15 text-pink-400 border-pink-500/30'         },
    closing             : { label: 'Closing Q&A',           bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'},
  };
  const phaseBadge = phaseBadgeMap[interview.currentPhase] || phaseBadgeMap.technical_deep_dive;

  return (
    <div className="fixed inset-0 h-screen w-screen bg-[#09090b] text-neutral-200 flex flex-col overflow-hidden font-sans select-none">

      {notice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-2.5 rounded-full shadow-lg z-50 flex items-center gap-2 text-sm font-bold">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {notice}
        </div>
      )}

      {/* ── Header ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-white/5 bg-[#09090b]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white text-sm font-semibold truncate">
            {interview.difficulty} {interview.type} Interview
          </span>
          <span className="text-neutral-400 text-xs font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10">Dynamic AI Interview</span>
          <span className="text-neutral-400 text-xs font-semibold tabular-nums">{timeRemainingLabel}</span>
          <span className={`hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full border ${phaseBadge.bg}`}>
            {phaseBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
          <p className={`text-xs font-bold uppercase tracking-wide ${statusColor}`}>{statusText}</p>
        </div>
      </header>

      {/* ── Main stage — no scroll ── */}
      <div className={`flex-1 min-h-0 flex overflow-hidden ${isCodingMode ? 'flex-row' : 'flex-col'}`}>

        {/* Interview stage */}
        <div className={`relative flex flex-col min-h-0 overflow-hidden ${isCodingMode ? 'w-1/2' : 'w-full flex-1'}`}>

          {/* Camera PIP — top right */}
          {/* Center content — interviewer + question */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 sm:px-12 overflow-hidden">

            {/* Interviewer */}
            <div className="shrink-0 flex flex-col items-center mb-5 sm:mb-8">
              <div className="relative">
                {phase === 'ai_speaking' && (
                  <div className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping scale-125"></div>
                )}
                {phase === 'listening' && (
                  <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse scale-125"></div>
                )}
                <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-[3px] transition-colors
                  ${phase === 'ai_speaking' ? 'border-emerald-500' :
                    phase === 'listening' ? 'border-amber-500' :
                    phase === 'processing' ? 'border-indigo-500' : 'border-neutral-700'}`}
                >
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400"
                    alt="Reecha"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <p className="text-white font-semibold text-sm mt-3">Reecha</p>
              <p className="text-neutral-500 text-xs">Interviewer</p>
            </div>

            {/* Question / processing state */}
            <div className="w-full max-w-4xl text-center flex flex-col items-center min-h-0">
              {lastAiMessage && phase !== 'processing' && (
                <div className="w-full max-h-[45vh] overflow-y-auto px-4 py-2 text-center scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                  <p className="text-lg sm:text-xl md:text-2xl font-medium text-white leading-relaxed whitespace-pre-wrap">
                    {lastAiMessage}
                  </p>
                </div>
              )}
              {phase === 'processing' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex gap-2">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2.5 h-2.5 rounded-full bg-indigo-500"
                        style={{ animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                  <p className="text-neutral-400 text-base">Evaluating your answer…</p>
                </div>
              )}
            </div>

            {/* Live transcript — compact, fully scrollable when listening */}
            {phase === 'listening' && (finalAnswer || liveTranscript) && (
              <div className="shrink-0 w-full max-w-2xl mt-4 px-4 py-3 bg-neutral-900/80 border border-white/10 rounded-xl max-h-32 overflow-y-auto">
                <p className="text-neutral-300 text-sm text-center leading-normal whitespace-pre-wrap">{finalAnswer || liveTranscript}</p>
              </div>
            )}
          </div>
        </div>

        {/* Code editor */}
        {isCodingMode && (
          <div className="w-1/2 min-h-0 overflow-hidden border-l border-white/5 bg-[#1e1e1e]">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value)}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                padding: { top: 12 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        )}
      </div>

      {/* ── Bottom control bar — fixed part of the screen ── */}
      <footer className="h-24 shrink-0 border-t border-white/10 bg-[#0c0c0e] flex items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={handleManualSubmit}
            disabled={isLocked}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              phase === 'listening'
                ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/60 hover:bg-amber-500/30'
                : 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
            }`}
          >
            {phase === 'processing' ? (
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : phase === 'listening' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
          </button>
          <span className="text-[11px] text-neutral-500">
            {phase === 'listening' ? 'Submit' : phase === 'ai_speaking' ? 'Wait' : 'Processing'}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => handleEndCall(false)}
            className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-[11px] text-neutral-500">End</span>
        </div>
      </footer>

      {showConfirmEnd && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1c1f26] border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">End Interview?</h3>
            <p className="text-neutral-400 text-sm mb-6">The interview will end and your progress is saved.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmEnd(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmEndCall}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 font-semibold"
              >
                End Now
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#121215] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Interview Conversation History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
              {interview.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border text-sm leading-relaxed ${
                    m.role === 'ai'
                      ? 'bg-neutral-900/90 border-indigo-500/20 text-neutral-200'
                      : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-100 ml-6'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs uppercase tracking-wider text-neutral-400">
                      {m.role === 'ai' ? 'Reecha (Interviewer)' : 'You'}
                    </span>
                    {m.phase && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-white/5 text-neutral-400">
                        {m.phase}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowHistory(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
