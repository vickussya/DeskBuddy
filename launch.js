/**
 * Launcher: strips ELECTRON_RUN_AS_NODE so Electron starts as a real app.
 * Use: node launch.js
 */
const { spawn } = require('child_process');
const path = require('path');

const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronExe, ['.'], {
  stdio: 'inherit',
  env,
  cwd: __dirname
});

child.on('close', (code) => process.exit(code || 0));
child.on('error', (err) => { console.error('Failed to start Electron:', err.message); process.exit(1); });
