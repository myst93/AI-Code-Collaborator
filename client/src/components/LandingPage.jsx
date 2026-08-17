import React, { useState, useEffect } from 'react';
import { Code2, Video, Sparkles, Users, Zap, Globe, ArrowRight, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: <Code2 size={24} />,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.2)',
    title: 'Real-time Collaboration',
    desc: 'Write code together with instant sync. Every keystroke shared across all participants with zero latency.',
  },
  {
    icon: <Video size={24} />,
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.2)',
    title: 'Live Video Interviews',
    desc: 'Conduct technical interviews face-to-face with HD WebRTC video — built directly into the editor.',
  },
  {
    icon: <Sparkles size={24} />,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
    title: 'Gemini AI Copilot',
    desc: 'Explain, debug, and optimize code with the power of Google Gemini AI — right inside your session.',
  },
  {
    icon: <Globe size={24} />,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
    title: 'Multi-language Support',
    desc: 'JavaScript, Python, C++, Java, Go — compile and run code instantly in any language.',
  },
  {
    icon: <Users size={24} />,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.2)',
    title: 'Team Rooms',
    desc: 'Create or join private rooms with shareable invite codes. No account linkage required.',
  },
  {
    icon: <Zap size={24} />,
    color: '#8b5cf6',
    glow: 'rgba(139,92,246,0.2)',
    title: 'Interactive Terminal',
    desc: 'Full stdin/stdout support. Interact with running programs in a real-time embedded terminal.',
  },
];

const CODE_DEMO = `// DevSync AI — Real-time Collaboration
function mergeIntervals(intervals) {
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0]];

  for (const [start, end] of intervals.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged; // ✅ O(n log n)
}`;

export default function LandingPage({ onStartInterview, onOpenEditor }) {
  const { user, openSignIn } = useAuth();
  const [typedCode, setTypedCode] = useState('');
  const [codeIdx, setCodeIdx] = useState(0);

  // Typewriter effect for code demo
  useEffect(() => {
    if (codeIdx < CODE_DEMO.length) {
      const t = setTimeout(() => {
        setTypedCode(CODE_DEMO.slice(0, codeIdx + 1));
        setCodeIdx((i) => i + 1);
      }, 18);
      return () => clearTimeout(t);
    }
  }, [codeIdx]);

  const handleStartInterview = () => {
    if (!user) {
      openSignIn(() => onStartInterview());
    } else {
      onStartInterview();
    }
  };

  const handleOpenEditor = () => {
    if (!user) {
      openSignIn(() => onOpenEditor());
    } else {
      onOpenEditor();
    }
  };

  return (
    <div className="landing-root">
      {/* ── Navigation ── */}
      <nav className="landing-nav glass">
        <div className="landing-nav-inner">
          <div className="logo-section">
            <Code2 className="logo-icon" size={28} />
            <span className="logo-text">DevSync AI</span>
            <span className="badge-ai">Gemini API</span>
          </div>
          <div className="landing-nav-actions">
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="landing-user-chip"
                  style={{ '--chip-color': user.avatarColor }}
                >
                  <span
                    className="landing-user-avatar"
                    style={{ background: user.avatarColor }}
                  >
                    {user.avatar}
                  </span>
                  <span>{user.name}</span>
                </div>
                <button className="btn btn-primary" onClick={onStartInterview}>
                  Go to App <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <button className="btn-google-sign" onClick={() => openSignIn()}>
                <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign in with Google
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-1" />
        <div className="landing-hero-glow landing-hero-glow-2" />

        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <Sparkles size={13} />
            <span>Powered by Google Gemini AI</span>
          </div>

          <h1 className="landing-hero-title">
            Code Together,<br />
            <span className="landing-hero-gradient">Interview Smarter.</span>
          </h1>

          <p className="landing-hero-subtitle">
            The all-in-one platform for technical interviews and real-time collaboration.
            Live code editing, HD video, and AI debugging — all in one tab.
          </p>

          <div className="landing-hero-ctas">
            <button className="btn btn-primary landing-cta-primary" onClick={handleStartInterview}>
              <Video size={18} />
              Start Interview Room
              <ArrowRight size={16} />
            </button>
            <button className="btn btn-secondary landing-cta-secondary" onClick={handleOpenEditor}>
              <Code2 size={18} />
              Open Code Editor
            </button>
          </div>

          <div className="landing-hero-stats">
            {[
              { val: '5+', label: 'Languages' },
              { val: 'WebRTC', label: 'Live Video' },
              { val: 'Gemini', label: 'AI Copilot' },
              { val: '∞', label: 'Rooms' },
            ].map(({ val, label }) => (
              <div key={label} className="landing-stat">
                <span className="landing-stat-val">{val}</span>
                <span className="landing-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Code Preview Card ── */}
        <div className="landing-code-card glass">
          <div className="landing-code-topbar">
            <div className="landing-traffic-lights">
              <span style={{ background: '#ff5f57' }} />
              <span style={{ background: '#febc2e' }} />
              <span style={{ background: '#28c840' }} />
            </div>
            <span className="landing-code-filename">
              <Code2 size={13} /> solution.js
            </span>
            <div className="landing-live-badge">
              <span className="landing-live-dot" />
              Live
            </div>
          </div>
          <pre className="landing-code-body">
            <code>{typedCode}<span className="landing-cursor">|</span></code>
          </pre>

          {/* Fake collaborator presence */}
          <div className="landing-collaborators">
            {['A', 'S', 'C'].map((letter, i) => (
              <div
                key={i}
                className="landing-collab-avatar"
                style={{ background: ['#6366f1','#ec4899','#10b981'][i], zIndex: 3 - i, marginLeft: i === 0 ? 0 : '-8px' }}
              >
                {letter}
              </div>
            ))}
            <span className="landing-collab-text">3 collaborating now</span>
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="landing-features">
        <div className="landing-section-label">
          <Zap size={14} />
          Everything you need
        </div>
        <h2 className="landing-section-title">Built for serious engineering teams</h2>
        <p className="landing-section-subtitle">
          From solo practice to large-scale technical interviews — DevSync AI handles it all.
        </p>

        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card glass" style={{ '--feat-color': f.color, '--feat-glow': f.glow }}>
              <div className="landing-feature-icon" style={{ color: f.color, background: f.glow }}>
                {f.icon}
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="landing-cta-banner">
        <div className="landing-cta-banner-inner glass">
          <div className="landing-hero-glow landing-hero-glow-1" style={{ opacity: 0.5 }} />
          <h2 className="landing-cta-banner-title">
            Ready to run your next interview?
          </h2>
          <p className="landing-cta-banner-sub">
            Sign in with Google and start a room in seconds. No configuration required.
          </p>
          <button className="btn btn-primary landing-cta-primary" onClick={handleStartInterview}>
            <Play size={16} fill="currentColor" />
            Get Started Free
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="logo-section" style={{ justifyContent: 'center' }}>
          <Code2 size={18} style={{ color: 'var(--primary)' }} />
          <span className="logo-text" style={{ fontSize: '1rem' }}>DevSync AI</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
          Built with React, WebRTC, Socket.IO & Google Gemini
        </p>
      </footer>
    </div>
  );
}
