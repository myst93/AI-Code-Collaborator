import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

// Deterministic avatar color from name string
const getAvatarColor = (name) => {
  const palette = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#10b981', '#06b6d4', '#f59e0b', '#3b82f6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authCallback, setAuthCallback] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('devsync_user');
      if (saved) setUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem('devsync_user');
    }
  }, []);

  // Open the Google sign-in modal; optional callback fires after sign-in
  const openSignIn = useCallback((onSuccess) => {
    setAuthCallback(() => onSuccess || null);
    setShowAuthModal(true);
  }, []);

  const handleSignIn = useCallback((name, email) => {
    const newUser = {
      name: name.trim(),
      email: email.trim(),
      avatar: name.trim().charAt(0).toUpperCase(),
      avatarColor: getAvatarColor(name.trim()),
      signedInAt: new Date().toISOString(),
    };
    localStorage.setItem('devsync_user', JSON.stringify(newUser));
    setUser(newUser);
    setShowAuthModal(false);
    if (authCallback) {
      authCallback(newUser);
      setAuthCallback(null);
    }
  }, [authCallback]);

  const signOut = useCallback(() => {
    localStorage.removeItem('devsync_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, openSignIn, signOut, isAuthenticated: !!user }}>
      {children}
      {showAuthModal && (
        <GoogleAuthModal
          onSignIn={handleSignIn}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

// ─── Google-styled Auth Modal ──────────────────────────────────────────────

const MOCK_ACCOUNTS = [
  { name: 'Alex Johnson', email: 'alex.johnson@gmail.com' },
  { name: 'Sam Patel', email: 'sam.patel@gmail.com' },
  { name: 'Chris Lee', email: 'chris.lee@gmail.com' },
];

function GoogleAuthModal({ onSignIn, onClose }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'custom'
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [error, setError] = useState('');

  const handleAccountClick = (account) => {
    onSignIn(account.name, account.email);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customName.trim()) { setError('Please enter your name'); return; }
    if (!customEmail.trim() || !customEmail.includes('@')) { setError('Please enter a valid email'); return; }
    onSignIn(customName, customEmail);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Google Logo */}
        <div className="auth-modal-logo">
          <svg width="40" height="40" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
        </div>

        <h2 className="auth-modal-title">Sign in with Google</h2>
        <p className="auth-modal-subtitle">to continue to DevSync AI</p>

        {step === 'choose' ? (
          <>
            <div className="auth-accounts-list">
              {MOCK_ACCOUNTS.map((acct) => (
                <button
                  key={acct.email}
                  className="auth-account-row"
                  onClick={() => handleAccountClick(acct)}
                >
                  <div
                    className="auth-account-avatar"
                    style={{ backgroundColor: getAvatarColor(acct.name) }}
                  >
                    {acct.name.charAt(0)}
                  </div>
                  <div className="auth-account-info">
                    <span className="auth-account-name">{acct.name}</span>
                    <span className="auth-account-email">{acct.email}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="auth-divider">
              <span>or use a different account</span>
            </div>

            <button
              className="auth-use-another"
              onClick={() => setStep('custom')}
            >
              + Use another account
            </button>
          </>
        ) : (
          <form className="auth-custom-form" onSubmit={handleCustomSubmit}>
            <div className="input-group">
              <label>Full Name</label>
              <input
                className="input-glow"
                type="text"
                placeholder="e.g. John Doe"
                value={customName}
                onChange={(e) => { setCustomName(e.target.value); setError(''); }}
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Email Address</label>
              <input
                className="input-glow"
                type="email"
                placeholder="e.g. john@gmail.com"
                value={customEmail}
                onChange={(e) => { setCustomEmail(e.target.value); setError(''); }}
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Continue
            </button>
            <button
              type="button"
              className="auth-back-btn"
              onClick={() => setStep('choose')}
            >
              ← Back
            </button>
          </form>
        )}

        <button className="auth-modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
