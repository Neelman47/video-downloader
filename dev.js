import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Starting YouTube Downloader Server and Client...\n');

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
  console.log('\nShutting down servers...');
  server.kill();
  client.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
