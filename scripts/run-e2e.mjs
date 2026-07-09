import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const servers = [
  {
    command: 'pnpm --dir apps/web exec vite --host 0.0.0.0 --port 5173',
    name: 'web',
    url: 'http://localhost:5173',
  },
  {
    command: 'pnpm --dir apps/admin exec vite --host 0.0.0.0 --port 5174',
    name: 'admin',
    url: 'http://localhost:5174',
  },
];

const started = [];

try {
  for (const server of servers) {
    if (await isReachable(server.url)) {
      continue;
    }

    const child = spawn(server.command, {
      env: process.env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => process.stdout.write(`[${server.name}] ${chunk}`));
    child.stderr.on('data', (chunk) => process.stderr.write(`[${server.name}] ${chunk}`));
    started.push(child);
    await waitForUrl(server.url, server.name);
  }

  const result = await runPlaywright();
  await stopStartedServers();
  process.exit(result);
} catch (error) {
  console.error(error);
  await stopStartedServers();
  process.exit(1);
}

async function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn('pnpm exec playwright test', {
      env: {
        ...process.env,
        E2E_SKIP_WEBSERVER: '1',
      },
      shell: true,
      stdio: 'inherit',
    });

    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function waitForUrl(url, name) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    if (await isReachable(url)) {
      return;
    }
    await delay(500);
  }

  throw new Error(`${name} dev server did not start in time.`);
}

async function isReachable(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function stopStartedServers() {
  await Promise.all(started.map((child) => stopProcessTree(child)));
}

async function stopProcessTree(child) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        shell: false,
        stdio: 'ignore',
      });
      killer.on('close', resolve);
      killer.on('error', resolve);
    });
    return;
  }

  child.kill('SIGTERM');
}
