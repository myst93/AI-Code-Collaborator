import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Code2, Copy, LogOut, Sparkles, Users, Video, PhoneOff } from 'lucide-react';
import EditorContainer from './components/EditorContainer';
import VideoGrid from './components/VideoGrid';
import AIPanel from './components/AIPanel';

const SOCKET_URL = 'http://localhost:5000';

function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [isInterviewMode, setIsInterviewMode] = useState(false);

  // Sync fullscreen exit via browser event (e.g. Esc key) back to App state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = document.fullscreenElement !== null;
      setIsInterviewMode(isFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState([]);
  
  // Real-time synchronization state
  const [code, setCode] = useState('// Welcome to DevSync AI!\n// Start coding collaboratively here.\n');
  const [language, setLanguage] = useState('javascript');
  const [compilerOutput, setCompilerOutput] = useState({ stdout: '', stderr: '', system: 'Run code using the compile panel below.' });
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
    if (newWidth > 260 && newWidth < 600) {
      setSidebarWidth(newWidth);
    }
  };

  const stopResizeX = () => {
    isDraggingX.current = false;
    document.removeEventListener('pointermove', handleResizeX);
    document.removeEventListener('pointerup', stopResizeX);
    document.body.style.cursor = 'default';
  };
  
  // AI Panel integration
  const [aiChat, setAiChat] = useState([
    { role: 'model', content: 'Hello! I am your DevSync AI Assistant. Click any of the quick action buttons or type a prompt to get help debugging, optimizing, or explaining code.' }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  // WebRTC Media & Peer Connections
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [socketId]: MediaStream }
  const [micMuted, setMicMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);

  const socketRef = useRef(null);
  const pcsRef = useRef({}); // { [socketId]: RTCPeerConnection }
  const localStreamRef = useRef(null);

  // Initialize WebSockets and room setup
  useEffect(() => {
    if (!joined) return;

    // Connect to WebSocket server
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join-room', { roomId, username });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room-users', (usersList) => {
      setUsers(usersList);
    });

    // Code editing state synchronization
    socket.on('initial-code', ({ code: initialCode, language: initialLanguage, chatHistory }) => {
      setCode(initialCode);
      setLanguage(initialLanguage);
      if (chatHistory) {
        setChatMessages(chatHistory);
      }
    });

    socket.on('chat-message', (chatMsg) => {
      setChatMessages((prev) => [...prev, chatMsg]);
    });

    socket.on('code-update', (updatedCode) => {
      setCode(updatedCode);
    });

    socket.on('language-update', (updatedLanguage) => {
      setLanguage(updatedLanguage);
    });

    socket.on('terminal-output', (data) => {
      setCompilerOutput((prev) => ({
        ...prev,
        stdout: prev.stdout + data,
      }));
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

        if (!pc) {
          pc = createPeerConnection(senderSocketId);
        }

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

    socket.on('user-left', ({ socketId, username: leftUsername }) => {
      // Close WebRTC connection
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
      // Clean up connections
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [joined]);

  // Request client permissions for mic & webcam
  const initLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 15 },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Add local tracks to any already established peer connections
      Object.keys(pcsRef.current).forEach((targetSocketId) => {
        const pc = pcsRef.current[targetSocketId];
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      });
    } catch (err) {
      console.warn('Failed to obtain webcam access. Testing with audio/video disabled.', err);
    }
  };

  // Create peer connection for multi-peer mesh
  const createPeerConnection = (targetSocketId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19002' },
        { urls: 'stun:stun1.l.google.com:19002' },
      ],
    });

    pcsRef.current[targetSocketId] = pc;

    // Send local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE gathering and sending
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-signal', {
          roomId,
          targetSocketId,
          signalData: { candidate: event.candidate },
        });
      }
    };

    // Track arrival (receiving remote streams)
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: remoteStream,
      }));
    };

    return pc;
  };

  // React to interview mode changes to allocate/release webcam resources
  useEffect(() => {
    if (!joined) return;

    if (isInterviewMode) {
      initLocalMedia();
    } else {
      // Release camera & microphone
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      // Reset WebRTC state
      setRemoteStreams({});
      Object.values(pcsRef.current).forEach((pc) => pc.close());
      pcsRef.current = {};
    }
  }, [isInterviewMode, joined]);

  // Sync peer call creation trigger when user list changes
  useEffect(() => {
    if (!joined || !socketRef.current || !isInterviewMode) return;

    users.forEach((user) => {
      const targetSocketId = user.socketId;
      if (targetSocketId === socketRef.current.id) return; // ignore self

      // Lexicographical ordering as a tie-breaker.
      // The socket with the lexicographically smaller ID creates the offer.
      if (socketRef.current.id < targetSocketId) {
        if (!pcsRef.current[targetSocketId]) {
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
      }
    });
  }, [users, isInterviewMode]);

  // Code input modification handler
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      socketRef.current.emit('code-change', { roomId, code: newCode });
    }
  };

  // Code programming language dropdown change
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    if (socketRef.current) {
      socketRef.current.emit('language-change', { roomId, language: newLang });
    }
  };

  const handleCursorChange = (cursorPosition) => {
    if (socketRef.current) {
      socketRef.current.emit('cursor-change', { roomId, cursor: cursorPosition, username });
    }
  };

  // Compile and run active editor code (Interactive Socket Stream)
  const handleRunCode = () => {
    if (!socketRef.current) return;
    
    setIsCompiling(true);
    setCompilerOutput({ stdout: '', stderr: '', system: '[System]: Initializing environment...\n' });
    
    socketRef.current.emit('run-code', { language, code });
  };

  const handleStopCode = () => {
    if (socketRef.current) {
      socketRef.current.emit('stop-code');
    }
  };

  const handleSendTerminalInput = (inputText) => {
    if (socketRef.current) {
      // Echo input back in the console logs log
      setCompilerOutput((prev) => ({
        ...prev,
        stdout: prev.stdout + inputText + '\n',
      }));
      socketRef.current.emit('terminal-input', inputText + '\n');
    }
  };

  // Send message to Gemini AI Agent API
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
          code: code,
          compilerOutput: compilerOutput.stdout || compilerOutput.stderr ? `STDOUT:\n${compilerOutput.stdout}\nSTDERR:\n${compilerOutput.stderr}` : 'None',
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
      setAiChat((prev) => [...prev, { role: 'model', content: `Failed to reach AI Backend. ${err.message}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Helper: Copy Invite link to clipboard
  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    alert(`Invite code copied: ${roomId}`);
  };

  // Toggle audio track
  const toggleMuteAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video track
  const toggleMuteVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Quick Action AI query
  const handleAiQuickAction = (actionType) => {
    let prompt = '';
    if (actionType === 'explain') {
      prompt = 'Explain what the current code does, breaking down its logic and performance characteristics.';
    } else if (actionType === 'debug') {
      prompt = 'Review this code for errors, syntax bugs, logical edge-cases, and efficiency gaps. If any compiler output is present, resolve that first. Provide a brief explanation of any problems and show how to fix them.';
    } else if (actionType === 'optimize') {
      prompt = 'Propose optimizations for this code to improve its time and space complexity (Big O). Provide the optimized refactored version.';
    }
    handleSendAiPrompt(prompt);
  };

  const handleSendChatMessage = (messageText) => {
    if (socketRef.current) {
      socketRef.current.emit('chat-message', { roomId, message: messageText, username });
    }
  };

  const toggleInterviewMode = () => {
    if (!isInterviewMode) {
      // Enter Interview Mode: Request Fullscreen
      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen().catch((err) => {
          console.error("Error entering fullscreen:", err);
        });
      }
      setIsInterviewMode(true);
    } else {
      // Exit Interview Mode: Exit Fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.error("Error exiting fullscreen:", err);
        });
      }
      setIsInterviewMode(false);
    }
  };

  const handleLeaveRoom = () => {
    setJoined(false);
    setRoomId('');
    setUsers([]);
    setLocalStream(null);
    setRemoteStreams({});
  };

  // Screen 1: Join/Create Room Room Configuration Layout
  if (!joined) {
    return (
      <div className="join-container">
        <div className="glass join-card">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <Code2 className="logo-icon" size={48} />
          </div>
          <h1 className="join-title">DevSync AI</h1>
          <p className="join-subtitle">Collaborative Editor with Video Call & Gemini AI Assistant</p>
          
          <form className="join-form" onSubmit={(e) => { e.preventDefault(); if (roomId && username) setJoined(true); }}>
            <div className="input-group">
              <label htmlFor="username">Full Name</label>
              <input
                id="username"
                className="input-glow"
                type="text"
                placeholder="e.g. John Doe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="room-id">Interview Room Code</label>
              <input
                id="room-id"
                className="input-glow"
                type="text"
                placeholder="Enter existing room code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              Join Interview Room
            </button>

            <div className="divider">OR</div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => {
                const generatedRoom = Math.random().toString(36).substring(2, 9).toUpperCase();
                setRoomId(generatedRoom);
              }}
            >
              Generate New Room Code
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Screen 2: Active Coding Workspace Layout
  return (
    <div className="app-container">
      {/* Top Header Controls */}
      <header className="glass top-bar">
        <div className="logo-section">
          <Code2 className="logo-icon" size={32} />
          <span className="logo-text">DevSync AI</span>
          <span className="badge-ai">Gemini API</span>
        </div>

        <div className="room-controls">
          <div className="status-indicator">
            <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
            <span>{connected ? 'Sync Connected' : 'Connecting...'}</span>
          </div>

          <div className="user-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <Users size={14} />
            <span>{users.length} Active</span>
          </div>

          {/* User Badge Avatars */}
          <div className="users-drawer">
            {users.map((user) => (
              <span className="user-badge" key={user.socketId}>
                <span className="user-avatar-dot" style={{ backgroundColor: '#' + user.socketId.substr(0, 6) }}></span>
                {user.username} {socketRef.current && user.socketId === socketRef.current.id && '(You)'}
              </span>
            ))}
          </div>

          <button className="btn btn-secondary" onClick={handleCopyLink} title="Copy Room ID">
            <Copy size={16} />
            <span>Room: {roomId}</span>
          </button>

          <button
            className={`btn ${isInterviewMode ? 'btn-danger' : 'btn-primary'}`}
            onClick={toggleInterviewMode}
            title={isInterviewMode ? "End Interview (Exit Fullscreen)" : "Start Interview (Enter Fullscreen)"}
          >
            {isInterviewMode ? <PhoneOff size={16} /> : <Video size={16} />}
            <span>{isInterviewMode ? 'End Interview' : 'Start Interview'}</span>
          </button>

          <button className="btn btn-danger" onClick={handleLeaveRoom} title="Leave Interview">
            <LogOut size={16} />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main 
        className={`main-workspace ${isInterviewMode ? 'interview-layout' : 'collaborative-layout'}`}
        style={{ gridTemplateColumns: `1fr 6px ${sidebarWidth}px` }}
      >
        {/* Left Side: Editor Section */}
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

        {/* Right Side: Media Panels and AI Assistant Chat */}
        <section className="sidebar-column" style={{ width: `${sidebarWidth}px` }}>
          {/* Video Grid (Only visible in Interview Mode) */}
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

          {/* AI Panel */}
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
