import { spawn } from 'child_process';

const server = spawn('npx', ['cross-env', 'NODE_ENV=production', 'PORT=8080', 'functions-framework', '--target=api']);

server.stdout.on('data', data => console.log('STDOUT:', data.toString()));
server.stderr.on('data', data => console.error('STDERR:', data.toString()));

setTimeout(async () => {
  try {
    const res = await fetch('http://localhost:8080/api/health');
    const text = await res.text();
    console.log('STATUS:', res.status, 'BODY:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  }
  server.kill();
  process.exit(0);
}, 5000);
