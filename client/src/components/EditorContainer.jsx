import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Code, ChevronDown, ChevronUp, Terminal, Square } from 'lucide-react';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python (3.x)' },
  { id: 'cpp', name: 'C++' },
  { id: 'java', name: 'Java' },
  { id: 'go', name: 'Go' },
];

const DEFAULT_TERMINAL_HEIGHT = 220;
const MIN_TERMINAL_HEIGHT = 80;
const MAX_TERMINAL_HEIGHT = 500;

function EditorContainer({
  code,
  language,
  compilerOutput,
  isCompiling,
  onCodeChange,
  onLanguageChange,
  onCursorChange,
  onRunCode,
  onStopCode,
  onSendTerminalInput,
}) {
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(DEFAULT_TERMINAL_HEIGHT);
  const [terminalInput, setTerminalInput] = useState('');
  const isDraggingY = useRef(false);
  const consoleEndRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll console to bottom when new logs stream in
  useEffect(() => {
    if (!isTerminalCollapsed) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [compilerOutput.stdout, compilerOutput.system, isCompiling, isTerminalCollapsed]);

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSendTerminalInput(terminalInput);
      setTerminalInput('');
    }
  };

  // ── Vertical resize (terminal height) ──────────────────────────────────────
  const handleResizeY = useCallback((e) => {
    if (!isDraggingY.current) return;
    e.preventDefault();

    const containerEl = containerRef.current;
    if (!containerEl) return;

    const containerRect = containerEl.getBoundingClientRect();
    // Height = distance from pointer to bottom of the container
    const newHeight = containerRect.bottom - e.clientY;

    if (newHeight >= MIN_TERMINAL_HEIGHT && newHeight <= MAX_TERMINAL_HEIGHT) {
      setTerminalHeight(newHeight);
    }
  }, []);

  const stopResizeY = useCallback(() => {
    isDraggingY.current = false;
    document.removeEventListener('pointermove', handleResizeY);
    document.removeEventListener('pointerup', stopResizeY);
    document.body.style.cursor = 'default';
  }, [handleResizeY]);

  const startResizeY = (e) => {
    e.preventDefault();
    isDraggingY.current = true;
    document.addEventListener('pointermove', handleResizeY);
    document.addEventListener('pointerup', stopResizeY);
    document.body.style.cursor = 'row-resize';
  };

  // Toggle collapse: restore to last terminalHeight when reopening
  const handleToggleTerminal = () => {
    setIsTerminalCollapsed((prev) => !prev);
  };

  const handleEditorChange = (value) => {
    onCodeChange(value || '');
  };

  const handleEditorMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });
  };

  return (
    <div className="editor-column-inner" ref={containerRef}>
      {/* ── Code Editor Glass Frame ── */}
      <div className="glass editor-wrapper">
        <div className="panel-header">
          <div className="panel-title">
            <Code size={18} style={{ color: 'var(--primary)' }} />
            <span>Interactive Editor</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="language-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>

            {isCompiling ? (
              <button
                className="btn btn-danger"
                onClick={onStopCode}
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              >
                <Square size={13} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="btn btn-success"
                onClick={onRunCode}
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              >
                <Play size={14} fill="currentColor" />
                <span>Run Code</span>
              </button>
            )}
          </div>
        </div>

        <div className="monaco-editor-container">
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              automaticLayout: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 12 },
              tabSize: 2,
              lineNumbersMinChars: 3,
            }}
          />
        </div>
      </div>

      {/* ── Horizontal Resize Handle (only when terminal is open) ── */}
      {!isTerminalCollapsed && (
        <div
          className="resize-handle-y"
          onPointerDown={startResizeY}
          title="Drag to resize terminal"
        />
      )}

      {/* ── Terminal Drawer Console ── */}
      <div
        className={`glass terminal-wrapper ${isTerminalCollapsed ? 'collapsed' : ''}`}
        style={{
          height: isTerminalCollapsed ? '45px' : `${terminalHeight}px`,
          flexShrink: 0,
        }}
      >
        {/* Terminal Header — click to toggle */}
        <div
          className="panel-header terminal-header-clickable"
          onClick={handleToggleTerminal}
        >
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} />
            <span>Terminal</span>
            {isCompiling && (
              <span className="terminal-running-badge">● Running</span>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="terminal-toggle-hint">
              {isTerminalCollapsed ? 'Click to expand' : 'Click to collapse'}
            </span>
            {isTerminalCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

        {/* Terminal Body */}
        {!isTerminalCollapsed && (
          <div className="terminal-console">
            {compilerOutput.system && (
              <div className="terminal-line terminal-system">{compilerOutput.system}</div>
            )}

            {compilerOutput.stdout && (
              <div className="terminal-line terminal-stdout" style={{ whiteSpace: 'pre-wrap' }}>
                {compilerOutput.stdout}
              </div>
            )}

            {!compilerOutput.stdout && !compilerOutput.system && (
              <div className="terminal-line terminal-system">
                Terminal idle. Click "Run Code" to compile and run.
              </div>
            )}

            {/* Interactive stdin prompt */}
            {isCompiling && (
              <div className="terminal-input-row" onClick={(e) => e.stopPropagation()}>
                <span className="terminal-prompt-arrow">&gt;</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  placeholder="Type input and press Enter..."
                  className="terminal-stdin-input"
                  autoFocus
                />
              </div>
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default EditorContainer;
