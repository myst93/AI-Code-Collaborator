import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, MessageSquare, User } from 'lucide-react';

function AIPanel({
  chatHistory,
  isLoading,
  onSendPrompt,
  onQuickAction,
  roomChatHistory = [],
  onSendRoomChatMessage,
}) {
  const [activeTab, setActiveTab] = useState('ai'); // 'ai' or 'chat'
  const [inputPrompt, setInputPrompt] = useState('');
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat history on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, roomChatHistory, isLoading, activeTab]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    if (activeTab === 'ai') {
      if (isLoading) return;
      onSendPrompt(inputPrompt);
    } else {
      onSendRoomChatMessage(inputPrompt);
    }
    
    setInputPrompt('');
  };

  // Custom inline formatter to render basic markdown code blocks and snippets in AI replies
  const formatMessageContent = (text) => {
    if (!text) return '';
    
    // Split by block code fences
    const blocks = text.split(/(```[\s\S]*?```)/g);
    
    return blocks.map((block, i) => {
      if (block.startsWith('```')) {
        // Extract language and code content
        const match = block.match(/```(\w*)\n([\s\S]*?)```/);
        const codeText = match ? match[2] : block.slice(3, -3);
        return (
          <pre key={i}>
            <code>{codeText.trim()}</code>
          </pre>
        );
      }
      
      // Split by inline code marks
      const inlineParts = block.split(/(`[^`\n]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((part, j) => {
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={j}>{part.slice(1, -1)}</code>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div className="glass ai-panel">
      {/* Tabbed Navigation */}
      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <Sparkles size={13} style={{ marginRight: '6px', display: 'inline' }} />
          AI Co-Pilot
        </button>
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={13} style={{ marginRight: '6px', display: 'inline' }} />
          Room Chat
        </button>
      </div>

      {/* AI Quick Actions (only visible when AI tab is active) */}
      {activeTab === 'ai' && (
        <div className="ai-quick-actions">
          <button
            className="btn btn-secondary btn-quick"
            onClick={() => onQuickAction('explain')}
            disabled={isLoading}
          >
            Explain Code
          </button>
          <button
            className="btn btn-secondary btn-quick"
            onClick={() => onQuickAction('debug')}
            disabled={isLoading}
          >
            Debug Code
          </button>
          <button
            className="btn btn-secondary btn-quick"
            onClick={() => onQuickAction('optimize')}
            disabled={isLoading}
          >
            Optimize
          </button>
        </div>
      )}

      {/* Chat Messages */}
      <div className="ai-chat-history">
        {activeTab === 'ai' ? (
          // Render Gemini Assistant Thread
          <>
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}
              >
                {msg.role === 'model' ? formatMessageContent(msg.content) : msg.content}
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-bubble ai" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="logo-icon" style={{ animation: 'spin 1.5s linear infinite' }}>
                  <Sparkles size={14} />
                </span>
                <span>AI is analyzing editor context...</span>
              </div>
            )}
          </>
        ) : (
          // Render Peer Room Chat Thread (from MongoDB / Live)
          <>
            {roomChatHistory.length === 0 ? (
              <div className="terminal-line terminal-system" style={{ textAlign: 'center', marginTop: '20px' }}>
                No room chat history yet. Say hello to start the interview!
              </div>
            ) : (
              roomChatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className="chat-bubble ai"
                  style={{
                    alignSelf: 'stretch',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    maxWidth: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                    <span>{msg.username}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{msg.timestamp}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{msg.message}</div>
                </div>
              ))
            )}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Form Input */}
      <form className="ai-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="input-glow ai-input"
          placeholder={activeTab === 'ai' ? "Ask Gemini co-pilot..." : "Send chat message to room..."}
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          disabled={activeTab === 'ai' && isLoading}
        />
        <button
          type="submit"
          className="btn-send"
          disabled={!inputPrompt.trim() || (activeTab === 'ai' && isLoading)}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default AIPanel;
