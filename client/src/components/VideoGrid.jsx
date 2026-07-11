import React, { useRef, useEffect } from 'react';
import { Video, VideoOff, Mic, MicOff, User } from 'lucide-react';

// Single Video element component to cleanly bind MediaStreams
function VideoStream({ stream, isLocal, username, isMuted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Check if video track is active
  const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && stream.getVideoTracks()[0].enabled;

  return (
    <div className="video-container">
      {stream && hasVideoTrack ? (
        <video
          ref={videoRef}
          className={`video-feed ${isLocal ? '' : 'remote'}`}
          autoPlay
          playsInline
          muted={isLocal} // Local stream must always be muted to prevent acoustic feedback loop
        />
      ) : (
        <div className="video-avatar">
          {username ? username.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : <User />}
        </div>
      )}

      {/* Profile Tag Overlay */}
      <div className="video-overlay-tag">
        <span className="user-avatar-dot" style={{ backgroundColor: isLocal ? 'var(--primary)' : 'var(--success)' }}></span>
        <span>{username} {isLocal && '(You)'}</span>
        {isMuted && <MicOff size={10} style={{ color: 'var(--danger)', marginLeft: '4px' }} />}
      </div>
    </div>
  );
}

function VideoGrid({
  users,
  localStream,
  remoteStreams,
  micMuted,
  videoMuted,
  onToggleAudio,
  onToggleVideo,
  socketId,
}) {
  const localUser = users.find(u => u.socketId === socketId);
  const localUsername = localUser ? localUser.username : 'User';

  return (
    <div className="glass video-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Video size={16} style={{ color: 'var(--primary)' }} />
          <span>Live Streams</span>
        </div>
        
        {/* Media Call Controller */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn-video-action ${micMuted ? 'muted' : ''}`}
            onClick={onToggleAudio}
            title={micMuted ? "Unmute Mic" : "Mute Mic"}
          >
            {micMuted ? <MicOff size={14} /> : <Mic size={14} />}
          </button>
          <button
            className={`btn-video-action ${videoMuted ? 'muted' : ''}`}
            onClick={onToggleVideo}
            title={videoMuted ? "Start Camera" : "Stop Camera"}
          >
            {videoMuted ? <VideoOff size={14} /> : <Video size={14} />}
          </button>
        </div>
      </div>

      <div className="video-grid">
        {/* 1. Local stream render */}
        <VideoStream
          stream={localStream}
          isLocal={true}
          username={localUsername}
          isMuted={micMuted}
        />

        {/* 2. Remote streams render */}
        {users
          .filter(user => user.socketId !== socketId)
          .map((user) => {
            const remoteStream = remoteStreams[user.socketId];
            return (
              <VideoStream
                key={user.socketId}
                stream={remoteStream}
                isLocal={false}
                username={user.username}
                isMuted={false} // in a simple P2P model, mute status is local only
              />
            );
          })}
      </div>
    </div>
  );
}

export default VideoGrid;
