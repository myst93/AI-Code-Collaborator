import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Code, ChevronDown, ChevronUp, Terminal } from 'lucide-react';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python (3.x)' },
  { id: 'cpp', name: 'C++' },
  { id: 'java', name: 'Java' },
  { id: 'go', name: 'Go' },
];

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
  const [terminalHeight, setTerminalHeight] = useState(220);
  const [terminalInput, setTerminalInput] = useState('');
  const isDraggingY = useRef(false);
  const consoleEndRef = useRef(null);

  // Auto-scroll console to bottom when new logs stream in
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [compilerOutput.stdout, isCompiling, isTerminalCollapsed]);

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSendTerminalInput(terminalInput);
      setTerminalInput('');
    }
  };

  const startResizeY = (e) => {
    e.preventDefault();
    isDraggingY.current = true;
    document.addEventListener('pointermove', handleResizeY);
    document.addEventListener('pointerup', stopResizeY);
    document.body.style.cursor = 'row-resize';
  };

  const handleResizeY = (e) => {
    if (!isDraggingY.current) return;
    const newHeight = window.innerHeight - e.clientY - 60;
    if (newHeight > 100 && newHeight < 450) {
      setTerminalHeight(newHeight);
    }
  };

  const stopResizeY = () => {
    isDraggingY.current = false;
    document.removeEventListener('pointermove', handleResizeY);
    document.removeEventListener('pointerup', stopResizeY);
    document.body.style.cursor = 'default';
  };

  const handleEditorChange = (value) => {
    onCodeChange(value || '');
  };

  const handleEditorMount = (editor, monaco) => {
    // Listen to cursor selection change events to sync cursors
    editor.onDidChangeCursorPosition((e) => {
      onCursorChange({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });
  };

  return (
    <>
      {/* Code Editor Glass Frame */}
      <div className="glass editor-wrapper">
        <div className="panel-header">
          <div className="panel-title">
            <Code size={18} style={{ color: 'var(--primary)' }} />
            <span>Interactive Editor</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Language Dropdown Selector */}
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

            <button
              className="btn btn-success"
              onClick={onRunCode}
              disabled={isCompiling}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              <Play size={14} fill="currentColor" />
              <span>{isCompiling ? 'Running...' : 'Run Code'}</span>
            </button>
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

      {/* Horizontal Resize Handle */}
      {!isTerminalCollapsed && (
        <div className="resize-handle-y" onPointerDown={startResizeY} />
      )}

      {/* Terminal Drawer Console */}
      <div 
        className={`glass terminal-wrapper ${isTerminalCollapsed ? 'collapsed' : ''}`}
        style={{ height: isTerminalCollapsed ? '45px' : `${terminalHeight}px` }}
      >
        <div 
          className="panel-header" 
          style={{ cursor: 'pointer' }}
          onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
        >
          <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} />
            <span>Terminal</span>
            {isCompiling && (
              <button 
                className="btn btn-danger" 
                onClick={(e) => { e.stopPropagation(); onStopCode(); }}
                style={{ padding: '2px 8px', fontSize: '0.7rem', marginLeft: '12px' }}
              >
                Stop Code
              </button>
            )}
          </div>

          <div style={{ marginLeft: 'auto' }}>
            {isTerminalCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>

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
              <div className="terminal-line terminal-system">Terminal idle. Click "Run Code" to compile and run.</div>
            )}

            {/* Interactive Prompt Line */}
            {isCompiling && (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginTop: '6px' }}>
                <span style={{ color: 'var(--success)', marginRight: '8px', fontWeight: 'bold' }}>&gt;</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  placeholder="Type input here and press Enter..."
                  style={{
                    flexGrow: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem',
                    padding: '0',
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()} // Prevent collapse on prompt focus
                />
              </div>
            )}
            <div ref={consoleEndRef} />
          </div>
        )}
      </div>
    </>
  );
}

export default EditorContainer;
