import React, { useState } from 'react';
import { Code2, Video, LogOut, Copy, Sparkles, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LobbyPage({ onJoinRoom }) {
  const { user, signOut } = useAuth();
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState(null); // 'interview' | 'editor'
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const code = Math.random().toString(36).substring(2, 9).toUpperCase();
    setRoomId(code);
  };

  const handleCopy = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim() || !mode) return;
    onJoinRoom({ roomId: roomId.trim(), username: user.name, mode });
  };

  return (
    <div className="lobby-root">
      {/* Background ambient glows */}
      <div className="lobby-glow lobby-glow-1" />
      <div className="lobby-glow lobby-glow-2" />

      {/* Top nav strip */}
      <nav className="lobby-nav glass">
        <div className="logo-section">
          <Code2 className="logo-icon" size={26} />
          <span className="logo-text">DevSync AI</span>
          <span className="badge-ai">Gemini API</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="landing-user-chip" style={{ '--chip-color': user.avatarColor }}>
            <span className="landing-user-avatar" style={{ background: user.avatarColor }}>
              {user.avatar}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{user.name}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.email}</span>
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={signOut}
            style={{ padding: '7px 14px', fontSize: '0.82rem' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="lobby-main">
        {/* Welcome header */}
        <div className="lobby-welcome">
          <div
            className="lobby-avatar"
            style={{ background: `linear-gradient(135deg, ${user.avatarColor}, ${user.avatarColor}88)` }}
          >
            {user.avatar}
          </div>
          <div>
            <h1 className="lobby-welcome-title">
              Welcome back, <span style={{ color: user.avatarColor }}>{user.name.split(' ')[0]}</span>
            </h1>
            <p className="lobby-welcome-sub">
              Choose how you want to get started today
            </p>
          </div>
        </div>

        {/* Mode Selection Cards */}
        <div className="lobby-mode-cards">
          <button
            className={`lobby-mode-card glass ${mode === 'interview' ? 'lobby-mode-card--active' : ''}`}
            style={{ '--mode-color': '#6366f1', '--mode-glow': 'rgba(99,102,241,0.15)' }}
            onClick={() => setMode('interview')}
            type="button"
          >
            <div className="lobby-mode-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
              <Video size={28} />
            </div>
            <div className="lobby-mode-info">
              <h3>Interview Room</h3>
              <p>Technical interview with live HD video, shared code editor, and AI assistance</p>
            </div>
            <div className="lobby-mode-check">
              {mode === 'interview' && (
                <span style={{ color: '#6366f1', fontSize: '1.4rem' }}>✓</span>
              )}
            </div>
            <div className="lobby-mode-tags">
              <span>Video Call</span>
              <span>Collaborative Code</span>
              <span>AI Copilot</span>
            </div>
          </button>

          <button
            className={`lobby-mode-card glass ${mode === 'editor' ? 'lobby-mode-card--active' : ''}`}
            style={{ '--mode-color': '#10b981', '--mode-glow': 'rgba(16,185,129,0.15)' }}
            onClick={() => setMode('editor')}
            type="button"
          >
            <div className="lobby-mode-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              <Code2 size={28} />
            </div>
            <div className="lobby-mode-info">
              <h3>Code Editor</h3>
              <p>Collaborative coding session with real-time sync, terminal, and Gemini AI chat</p>
            </div>
            <div className="lobby-mode-check">
              {mode === 'editor' && (
                <span style={{ color: '#10b981', fontSize: '1.4rem' }}>✓</span>
              )}
            </div>
            <div className="lobby-mode-tags">
              <span>Real-time Sync</span>
              <span>Terminal</span>
              <span>5 Languages</span>
            </div>
          </button>
        </div>

        {/* Room Code Input + CTA */}
        <form className="lobby-room-form glass" onSubmit={handleJoin}>
          <div className="lobby-form-header">
            <Users size={18} style={{ color: 'var(--primary)' }} />
            <span>Room Configuration</span>
          </div>

          <div className="lobby-room-input-row">
            <div className="input-group" style={{ flex: 1 }}>
              <label htmlFor="lobby-room-id">Interview Room Code</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="lobby-room-id"
                  className="input-glow"
                  type="text"
                  placeholder="Enter or generate a room code"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  style={{ flex: 1, letterSpacing: '1px', fontWeight: 600 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopy}
                  title="Copy room code"
                  disabled={!roomId}
                  style={{ padding: '10px 14px', flexShrink: 0 }}
                >
                  <Copy size={15} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="lobby-form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleGenerate}
            >
              <Sparkles size={15} />
              Generate Room Code
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!roomId.trim() || !mode}
              style={{ flex: 1 }}
            >
              {mode === 'interview' ? <Video size={16} /> : <Code2 size={16} />}
              {mode === 'interview' ? 'Join Interview Room' : mode === 'editor' ? 'Open Code Editor' : 'Select a Mode Above'}
              {(mode) && <ArrowRight size={15} />}
            </button>
          </div>

          {!mode && (
            <p className="lobby-hint">
              ↑ Select Interview Room or Code Editor above to continue
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
