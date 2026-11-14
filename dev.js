import { spawn } from 'child_process';
import path from 'path';

console.log('\n=============================================================');
console.log('🚀 StreamVault YouTube Downloader - Development Mode');
console.log('👉 Frontend Dev UI:   http://localhost:5173');
console.log('👉 Backend API:       http://localhost:5000');
console.log('👉 Full App Running:  Open http://localhost:5173 in browser');
console.log('=============================================================\n');

// Start Express Backend
const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: true
});

// Start Vite Client
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const client = spawn(npmCmd, ['run', 'dev', '--prefix', 'client'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  console.log('\nShutting down StreamVault dev servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
