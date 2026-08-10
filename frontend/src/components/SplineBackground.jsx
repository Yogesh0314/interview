import { Suspense, lazy, useState, memo } from 'react';

const Spline = lazy(() => import('@splinetool/react-spline'));

/**
 * Spline 3D background component rendered exclusively on Landing Page.
 * Renders the interactive Spline 3D scene with crystal clear visibility.
 */
const SplineBackground = memo(function SplineBackground() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none" aria-hidden="true">
      {/* ── Spline 3D Scene ── */}
      <div
        className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Suspense fallback={<div className="w-full h-full bg-black animate-pulse" />}>
          <Spline
            scene="https://prod.spline.design/DluDKEITZOEq7dAK/scene.splinecode"
            onLoad={() => setLoaded(true)}
            style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}
          />
        </Suspense>
      </div>

      {/* ── Subtle dark gradient at top for navbar text contrast ── */}
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />

      {/* ── Bottom Right Mask Badge (Covers "Built with Spline" watermark tag cleanly without zoom or blur) ── */}
      <div className="absolute bottom-4 right-4 z-30 pointer-events-auto">
        <div className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-[#070709] border border-neutral-800 text-xs font-semibold text-neutral-300 shadow-[0_10px_30px_rgba(0,0,0,0.95)] backdrop-blur-2xl hover:border-indigo-500/40 transition-colors">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="tracking-wide">Interview.AI</span>
        </div>
      </div>
    </div>
  );
});

export default SplineBackground;
