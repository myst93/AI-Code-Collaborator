import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Code2, Copy, LogOut, Sparkles, Users, Video, PhoneOff } from 'lucide-react';
import EditorContainer from './components/EditorContainer';
import VideoGrid from './components/VideoGrid';
import AIPanel from './components/AIPanel';
import LandingPage from './components/LandingPage';
import LobbyPage from './components/LobbyPage';
import { useAuth } from './context/AuthContext';

const SOCKET_URL = 'http://localhost:5000';

// Screen states: 'landing' | 'lobby' | 'room'
function App() {
  const { user, isAuthenticated, openSignIn } = useAuth();

  // ── Screen state machine ──────────────────────────────────────────────────
  // Initialize to 'lobby' immediately if user already authenticated (persisted)
  const [screen, setScreen] = useState(function () {
    try {
      const saved = localStorage.getItem('devsync_user');
      return saved ? 'lobby' : 'landing';
    } catch (e) {
      return 'landing';
    }
  });

  // Sync screen with auth state changes
  useEffect(() => {
    if (!isAuthenticated && screen !== 'landing') {
      setScreen('landing');
    }
    if (isAuthenticated && screen === 'landing') {
      setScreen('lobby');
    }
  }, [isAuthenticated]);

  // Manage body overflow: room needs overflow:hidden, landing/lobby needs scroll
  useEffect(() => {
    if (screen === 'room') {
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
    } else {
      document.body.style.overflow = '';
      document.body.style.height = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [screen]);

  // ── Room state ────────────────────────────────────────────────────────────
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInterviewMode, setIsInterviewMode] = useState(false);

  // Sync fullscreen exit (Esc key) back to state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = document.fullscreenElement !== null;
      setIsInterviewMode(isFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);

  // Real-time sync state
  const [code, setCode] = useState('// Welcome to DevSync AI!\n// Start coding collaboratively here.\n');
  const [language, setLanguage] = useState('javascript');
  const [compilerOutput, setCompilerOutput] = useState({
    stdout: '',
    stderr: '',
    system: 'Run code using the compile panel below.',
  });
  const [isCompiling, setIsCompiling] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const isDraggingX = useRef(false);

  const startResizeX = (e) => {
    e.preventDefault();
    isDraggingX.current = true;
    document.addEventListener('pointermove', handleResizeX);
    document.addEventListener('pointerup', stopResizeX);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeX = (e) => {
    if (!isDraggingX.current) return;
    const newWidth = window.innerWidth - e.clientX - 32;
    if (newWidth > 260 && newWidth < 620) setSidebarWidth(newWidth);
  };

  const stopResizeX = () => {
    isDraggingX.current = false;
    document.removeEventListener('pointermove', handleResizeX);
    document.removeEventListener('pointerup', stopResizeX);
    document.body.style.cursor = 'default';
  };

  // AI Panel
  const [aiChat, setAiChat] = useState([
    {
      role: 'model',
      content:
        'Hello! I am your DevSync AI Assistant. Click any of the quick action buttons or type a prompt to get help debugging, optimizing, or explaining code.',
    },
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  // WebRTC
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  const socketRef = useRef(null);
  const pcsRef = useRef({});
  const localStreamRef = useRef(null);

  // ── Initialize WebSockets on room join ───────────────────────────────────
  useEffect(() => {
    if (screen !== 'room') return;

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { roomId, username });
    });

    socket.on('disconnect', () => setConnected(false));
    socket.on('room-users', (usersList) => setUsers(usersList));

    socket.on('initial-code', ({ code: initialCode, language: initialLanguage, chatHistory }) => {
      setCode(initialCode);
      setLanguage(initialLanguage);
      if (chatHistory) setChatMessages(chatHistory);
    });

    socket.on('chat-message', (chatMsg) =>
      setChatMessages((prev) => [...prev, chatMsg])
    );
    socket.on('code-update', (updatedCode) => setCode(updatedCode));
    socket.on('language-update', (updatedLanguage) => setLanguage(updatedLanguage));

    socket.on('terminal-output', (data) => {
      setCompilerOutput((prev) => ({ ...prev, stdout: prev.stdout + data }));
    });

    socket.on('terminal-exit', (exitCode) => {
      setIsCompiling(false);
      setCompilerOutput((prev) => ({
        ...prev,
        system: `[System]: Process completed with exit code: ${exitCode}\n`,
      }));
    });

    // WebRTC signaling
    socket.on('webrtc-signal', async ({ senderSocketId, signalData }) => {
      try {
        let pc = pcsRef.current[senderSocketId];
        if (!pc) pc = createPeerConnection(senderSocketId);

        if (signalData.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          if (signalData.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-signal', {
              roomId,
              targetSocketId: senderSocketId,
              signalData: { sdp: pc.localDescription },
            });
          }
        } else if (signalData.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (error) {
        console.error('WebRTC Signaling Error:', error);
      }
    });

    socket.on('user-left', ({ socketId }) => {
      if (pcsRef.current[socketId]) {
        pcsRef.current[socketId].close();
        delete pcsRef.current[socketId];
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    return () => {
      socket.disconnect();
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [screen, roomId, username]);

  // ── Media: request mic/cam ────────────────────────────────────────────────
  const initLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15 },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      Object.keys(pcsRef.current).forEach((targetSocketId) => {
        const pc = pcsRef.current[targetSocketId];
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      });
    } catch (err) {
      console.warn('Failed to obtain webcam access.', err);
    }
  };

  // ── WebRTC peer connection factory ────────────────────────────────────────
  const createPeerConnection = (targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19002' },
        { urls: 'stun:stun1.l.google.com:19002' },
      ],
    });
    pcsRef.current[targetSocketId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-signal', {
          roomId,
          targetSocketId,
          signalData: { candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => ({ ...prev, [targetSocketId]: remoteStream }));
    };

    return pc;
  };

  // Interview mode: allocate/release webcam resources
  useEffect(() => {
    if (screen !== 'room') return;
    if (isInterviewMode) {
      initLocalMedia();
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      setRemoteStreams({});
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
    }
  }, [isInterviewMode, screen]);

  // Peer offer creation when users list changes
  useEffect(() => {
    if (screen !== 'room' || !socketRef.current || !isInterviewMode) return;
    users.forEach((user) => {
      const targetSocketId = user.socketId;
      if (targetSocketId === socketRef.current.id) return;
      if (socketRef.current.id < targetSocketId && !pcsRef.current[targetSocketId]) {
        const pc = createPeerConnection(targetSocketId);
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socketRef.current.emit('webrtc-signal', {
              roomId,
              targetSocketId,
              signalData: { sdp: pcsRef.current[targetSocketId].localDescription },
            });
          })
          .catch((e) => console.error('Failed to create offer:', e));
      }
    });
  }, [users, isInterviewMode]);

  // ── Event Handlers ────────────────────────────────────────────────────────
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) socketRef.current.emit('code-change', { roomId, code: newCode });
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (socketRef.current) socketRef.current.emit('language-change', { roomId, language: newLang });
  };

  const handleCursorChange = (cursorPosition) => {
    if (socketRef.current)
      socketRef.current.emit('cursor-change', { roomId, cursor: cursorPosition, username });
  };

  const handleRunCode = () => {
    if (!socketRef.current) return;
    setIsCompiling(true);
    setCompilerOutput({ stdout: '', stderr: '', system: '[System]: Initializing environment...\n' });
    socketRef.current.emit('run-code', { language, code });
  };

  const handleStopCode = () => {
    if (socketRef.current) socketRef.current.emit('stop-code');
  };

  const handleSendTerminalInput = (inputText) => {
    if (socketRef.current) {
      setCompilerOutput((prev) => ({ ...prev, stdout: prev.stdout + inputText + '\n' }));
      socketRef.current.emit('terminal-input', inputText + '\n');
    }
  };

  const handleSendAiPrompt = async (promptText) => {
    if (!promptText.trim()) return;
    const userMessage = { role: 'user', content: promptText };
    setAiChat((prev) => [...prev, userMessage]);
    setIsAiLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          code,
          compilerOutput:
            compilerOutput.stdout || compilerOutput.stderr
              ? `STDOUT:\n${compilerOutput.stdout}\nSTDERR:\n${compilerOutput.stderr}`
              : 'None',
          history: aiChat,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAiChat((prev) => [...prev, { role: 'model', content: `AI Error: ${data.error}` }]);
      } else {
        setAiChat((prev) => [...prev, { role: 'model', content: data.response }]);
      }
    } catch (err) {
      setAiChat((prev) => [
        ...prev,
        { role: 'model', content: `Failed to reach AI Backend. ${err.message}` },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    alert(`Invite code copied: ${roomId}`);
  };

  const toggleMuteAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleMuteVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const handleAiQuickAction = (actionType) => {
    let prompt = '';
    if (actionType === 'explain')
      prompt = 'Explain what the current code does, breaking down its logic and performance characteristics.';
    else if (actionType === 'debug')
      prompt =
        'Review this code for errors, syntax bugs, logical edge-cases, and efficiency gaps. If any compiler output is present, resolve that first.';
    else if (actionType === 'optimize')
      prompt =
        'Propose optimizations for this code to improve its time and space complexity (Big O). Provide the optimized refactored version.';
    handleSendAiPrompt(prompt);
  };

  const handleSendChatMessage = (messageText) => {
    if (socketRef.current)
      socketRef.current.emit('chat-message', { roomId, message: messageText, username });
  };

  const toggleInterviewMode = () => {
    if (!isInterviewMode) {
      const element = document.documentElement;
      if (element.requestFullscreen) element.requestFullscreen().catch(console.error);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(console.error);
    }
  };

  const handleLeaveRoom = () => {
    setScreen('lobby');
    setRoomId('');
    setUsers([]);
    setConnected(false);
    setLocalStream(null);
    setRemoteStreams({});
    setIsInterviewMode(false);
    // Exit fullscreen if active
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => { });
    }
  };

  // ── Screen: Landing ───────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LandingPage
        onStartInterview={() => isAuthenticated && setScreen('lobby')}
        onOpenEditor={() => isAuthenticated && setScreen('lobby')}
      />
    );
  }

  // ── Screen: Lobby ─────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <LobbyPage
        onJoinRoom={({ roomId: rid, username: uname, mode }) => {
          setRoomId(rid);
          setUsername(uname);
          setIsInterviewMode(false); // video starts only when user clicks "Start Interview" inside room
          setCode('// Welcome to DevSync AI!\n// Start coding collaboratively here.\n');
          setCompilerOutput({ stdout: '', stderr: '', system: 'Run code using the compile panel below.' });
          setAiChat([
            {
              role: 'model',
              content: 'Hello! I am your DevSync AI Assistant. Ask me anything about your code.',
            },
          ]);
          setChatMessages([]);
          setScreen('room');
        }}
      />
    );
  }

  // ── Screen: Room (Active Workspace) ──────────────────────────────────────
  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="glass top-bar">
        <div className="logo-section">
          <Code2 className="logo-icon" size={28} />
          <span className="logo-text">DevSync AI</span>
          <span className="badge-ai">Gemini API</span>
        </div>

        <div className="room-controls">
          <div className="status-indicator">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
            <span>{connected ? 'Sync Connected' : 'Connecting...'}</span>
          </div>

          <div className="user-badge" style={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}>
            <Users size={14} />
            <span>{users.length} Active</span>
          </div>

          <div className="users-drawer">
            {users.map((u) => (
              <span className="user-badge" key={u.socketId}>
                <span
                  className="user-avatar-dot"
                  style={{ backgroundColor: '#' + u.socketId.substr(0, 6) }}
                />
                {u.username} {socketRef.current && u.socketId === socketRef.current.id && '(You)'}
              </span>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleCopyLink} title="Copy Room ID">
            <Copy size={15} />
            <span>Room: {roomId}</span>
          </button>

          <button
            className={`btn ${isInterviewMode ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleInterviewMode}
            title={isInterviewMode ? 'End Interview' : 'Start Interview'}
          >
            {isInterviewMode ? <PhoneOff size={15} /> : <Video size={15} />}
            <span>{isInterviewMode ? 'End Interview' : 'Start Interview'}</span>
          </button>

          {/* User avatar chip */}
          {user && (
            <div
              className="landing-user-chip"
              style={{ '--chip-color': user.avatarColor }}
            >
              <span
                className="landing-user-avatar"
                style={{ background: user.avatarColor, width: '26px', height: '26px', fontSize: '0.75rem' }}
              >
                {user.avatar}
              </span>
              <span style={{ fontSize: '0.82rem' }}>{user.name.split(' ')[0]}</span>
            </div>
          )}

          <button className="btn btn-danger" onClick={handleLeaveRoom} title="Leave Room">
            <LogOut size={15} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main
        className={`main-workspace ${isInterviewMode ? 'interview-layout' : 'collaborative-layout'}`}
        style={{ gridTemplateColumns: `1fr 6px ${sidebarWidth}px` }}
      >
        {/* Left: Editor + Terminal */}
        <section className="editor-column">
          <EditorContainer
            code={code}
            language={language}
            compilerOutput={compilerOutput}
            isCompiling={isCompiling}
            onCodeChange={handleCodeChange}
            onLanguageChange={handleLanguageChange}
            onCursorChange={handleCursorChange}
            onRunCode={handleRunCode}
            onStopCode={handleStopCode}
            onSendTerminalInput={handleSendTerminalInput}
          />
        </section>

        {/* Vertical Resize Handle */}
        <div className="resize-handle-x" onPointerDown={startResizeX} />

        {/* Right: Video + AI Panel */}
        <section className="sidebar-column">
          {isInterviewMode && (
            <VideoGrid
              users={users}
              localStream={localStream}
              remoteStreams={remoteStreams}
              micMuted={micMuted}
              videoMuted={videoMuted}
              onToggleAudio={toggleMuteAudio}
              onToggleVideo={toggleMuteVideo}
              socketId={socketRef.current ? socketRef.current.id : ''}
            />
          )}

          <AIPanel
            chatHistory={aiChat}
            isLoading={isAiLoading}
            onSendPrompt={handleSendAiPrompt}
            onQuickAction={handleAiQuickAction}
            roomChatHistory={chatMessages}
            onSendRoomChatMessage={handleSendChatMessage}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
