import { Link } from 'react-router-dom';
import SplineBackground from '../components/SplineBackground';
import Navbar from '../components/Navbar';

const FEATURES = [
  {
    title: 'AI-Powered Interviews',
    description:
      'Practice with an intelligent AI interviewer that adapts questions to your skill level and target role.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    ),
  },
  {
    title: 'Real-Time Feedback',
    description:
      'Receive instant, actionable feedback on your answers, communication style, and technical accuracy.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: 'Personalized Practice',
    description:
      'Tailored interview sessions based on your target role, experience level, and areas for improvement.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    title: 'Performance Analytics',
    description:
      'Track your progress over time with detailed scoring, insights, and improvement recommendations.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen flex flex-col text-neutral-100 overflow-x-hidden">
      {/* ── Spline 3D Scene (Fixed Background Exclusive to Landing Page) ── */}
      <SplineBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Navbar ── */}
        <Navbar />

        {/* ── Hero Section ── */}
        <section className="relative w-full min-h-[calc(100vh-65px)] flex items-center py-16 lg:py-24">
          <div className="w-full max-w-7xl mx-auto px-6 sm:px-8 md:px-10">
            <div className="max-w-2xl stagger-children">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/80 border border-neutral-800 text-xs font-semibold text-indigo-400 mb-6 backdrop-blur-md shadow-md">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI-Powered Interview Practice Platform
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                Practice Smarter.{' '}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300">
                  Interview Better.
                </span>
              </h1>

              <p className="mt-6 text-base sm:text-lg lg:text-xl text-neutral-300 max-w-xl leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Prepare for top tech & professional interviews with real-time AI voice/text evaluation, instant feedback, and targeted skill analytics.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-start gap-4">
                <Link
                  to="/register"
                  className="btn-primary text-base w-full sm:w-auto px-7 py-3.5"
                  aria-label="Get started with Interview.ai for free"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Get Started Free
                </Link>
                <Link
                  to="/login"
                  className="btn-secondary text-base w-full sm:w-auto text-center px-7 py-3.5"
                  aria-label="Sign in to your Interview.ai account"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features Section — Spline background remains fixed and visible continuously ── */}
        <section className="w-full max-w-7xl mx-auto px-6 sm:px-8 md:px-10 py-16 lg:py-24">
          <div className="text-center mb-12 lg:mb-16 stagger-children">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Everything you need to{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-300">
                ace your interview
              </span>
            </h2>
            <p className="mt-4 text-neutral-400 max-w-2xl mx-auto text-base sm:text-lg">
              Our AI platform gives you the realistic practice, granular scoring, and actionable feedback needed to excel.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 stagger-children">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="stat-card group bg-neutral-950/70 backdrop-blur-xl border border-neutral-800/80 shadow-2xl hover:border-indigo-500/40">
                <div className="relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-indigo-400 mb-4 group-hover:border-indigo-500/50 group-hover:scale-105 transition-all">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section className="w-full max-w-7xl mx-auto px-6 sm:px-8 md:px-10 py-16 lg:py-24">
          <div className="glass-panel rounded-3xl p-8 sm:p-12 lg:p-16 text-center relative overflow-hidden bg-neutral-950/70 backdrop-blur-xl border border-neutral-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                Ready to elevate your career?
              </h2>
              <p className="text-neutral-300 max-w-xl mx-auto mb-8 text-base sm:text-lg leading-relaxed">
                Join candidates who sharpen their technical & behavioral interview skills with AI-powered practice.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/register"
                  className="btn-primary text-base w-full sm:w-auto px-8 py-3.5"
                  aria-label="Start practicing interviews now"
                >
                  Start Practicing Now
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link
                  to="/login"
                  className="btn-secondary text-base w-full sm:w-auto text-center px-8 py-3.5"
                  aria-label="Sign in to your existing account"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="w-full border-t border-neutral-800/80 mt-auto bg-black/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 md:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {/* <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-extrabold text-white text-[10px] shadow-sm">
                AI
              </div> */}
              <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                Interview.ai
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              © {new Date().getFullYear()} Interview.ai. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
