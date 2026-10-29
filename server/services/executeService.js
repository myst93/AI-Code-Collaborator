import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// TEMP_DIR is server/temp_runs
const TEMP_DIR = path.join(__dirname, '..', 'temp_runs');

// Ensure compile sandbox directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * REST Endpoint execution (Buffered/Sync)
 */
export const executeCodeSync = ({ language, code, stdin }) => {
  return new Promise((resolve, reject) => {
    const runId = Math.random().toString(36).substring(2, 9);
    const runDir = path.join(TEMP_DIR, runId);
    fs.mkdirSync(runDir, { recursive: true });

    let filename = '';
    let compileCmd = '';
    let runCmd = '';

    switch (language.toLowerCase()) {
      case 'javascript':
        filename = 'main.js';
        runCmd = `node ${filename}`;
        break;
      case 'python':
        filename = 'main.py';
        runCmd = `python3 ${filename} || python ${filename}`;
        break;
      case 'cpp':
        filename = 'main.cpp';
        compileCmd = `g++ main.cpp -o main_bin`;
        runCmd = `./main_bin`;
        break;
      case 'java':
        filename = 'Main.java';
        compileCmd = `javac Main.java`;
        runCmd = `java Main`;
        break;
      case 'go':
        filename = 'main.go';
        runCmd = `go run main.go`;
        break;
      default:
        try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
        return reject(new Error(`Language ${language} is not supported for local compilation.`));
    }

    // Write temporary source file
    const filePath = path.join(runDir, filename);
    fs.writeFileSync(filePath, code);

    // Sandboxed child process execution parameters
    const execOptions = {
      cwd: runDir,
      timeout: 5000, // 5 seconds timeout limit to prevent loops hanging the thread
      maxBuffer: 1024 * 1024, // 1MB maximum buffer threshold
      env: {
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        LANG: 'C.UTF-8',
        LC_ALL: 'C.UTF-8',
        HOME: runDir,
        TMPDIR: runDir,
      },
    };

    const cleanup = () => {
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch (cleanErr) {
        console.error('Temp compilation dir clean error:', cleanErr.message);
      }
    };

    const runBinary = () => {
      const child = exec(runCmd, execOptions, (err, stdout, stderr) => {
        cleanup();
        if (err && err.killed) {
          resolve({
            stdout,
            stderr: `${stderr}\n[Timeout Error]: Script execution exceeded the 5-second sandbox limit.`,
            code: 124, // standard core timeout status code
          });
        } else {
          resolve({
            stdout,
            stderr: stderr || (err ? err.message : ''),
            code: err ? err.code || 1 : 0,
          });
        }
      });

      // Feed standard input (stdin) if provided
      if (stdin && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    };

    // Run compiler check first if compilation command is active (e.g. C++, Java)
    if (compileCmd) {
      exec(compileCmd, execOptions, (cErr, cStdout, cStderr) => {
        if (cErr) {
          cleanup();
          resolve({
            stdout: cStdout,
            stderr: cStderr || cErr.message,
            code: cErr.code || 1,
          });
          return;
        }
        runBinary();
      });
    } else {
      runBinary();
    }
  });
};

/**
 * Socket.IO Streaming execution setup
 */
export const prepareStreamingExecution = ({ language, code }) => {
  const runId = Math.random().toString(36).substring(2, 9);
  const runDir = path.join(TEMP_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  let filename = '';
  let compileCmd = '';
  let runCmd = '';
  let execArgs = [];

  switch (language.toLowerCase()) {
    case 'javascript':
      filename = 'main.js';
      runCmd = 'node';
      execArgs = ['main.js'];
      break;
    case 'python':
      filename = 'main.py';
      runCmd = 'python3';
      execArgs = ['main.py'];
      break;
    case 'cpp':
      filename = 'main.cpp';
      compileCmd = `g++ main.cpp -o main_bin`;
      runCmd = './main_bin';
      execArgs = [];
      break;
    case 'java':
      filename = 'Main.java';
      compileCmd = `javac Main.java`;
      runCmd = 'java';
      execArgs = ['Main'];
      break;
    case 'go':
      filename = 'main.go';
      runCmd = 'go';
      execArgs = ['run', 'main.go'];
      break;
    default:
      try { fs.rmSync(runDir, { recursive: true, force: true }); } catch (e) {}
      throw new Error(`Language ${language} is not supported.`);
  }

  // Write code file
  const filePath = path.join(runDir, filename);
  fs.writeFileSync(filePath, code);

  const cleanup = () => {
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch (e) {}
  };

  return {
    runDir,
    compileCmd,
    runCmd,
    execArgs,
    cleanup
  };
};
