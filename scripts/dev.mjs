import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commonEnv = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' };
const apiPort = process.env.API_PORT || '8080';
const dashboardPort = process.env.DASHBOARD_PORT || '5173';
const services = [
  {
    label: 'API server',
    workspace: '@workspace/api-server',
    env: { ...commonEnv, PORT: apiPort },
  },
  {
    label: 'Dashboard',
    workspace: '@workspace/sensor-dashboard',
    env: { ...commonEnv, PORT: dashboardPort, BASE_PATH: process.env.BASE_PATH || '/' },
  },
];

let stopping = false;
let exitCode = 0;
const children = services.map((service) => {
  const child = spawn(
    npmCommand,
    ['run', 'dev', `--workspace=${service.workspace}`],
    { cwd: process.cwd(), env: service.env, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  child.once('error', (error) => {
    console.error(`${service.label} failed to start:`, error);
    shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (stopping) return;
    console.error(`${service.label} stopped${signal ? ` (${signal})` : ` with code ${code}`}.`);
    shutdown(code && code !== 0 ? code : 1);
  });
  return child;
});

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 5000);
  forceStop.unref();
  process.exitCode = exitCode;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
