// 后台拉起 web dev server(供 preview-home.mjs 截图用),pid 记入 tmp-dev-logs/preview-dev.pid。
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';

mkdirSync('tmp-dev-logs', { recursive: true });
const out = openSync('tmp-dev-logs/preview-dev.log', 'w');
const child = spawn('pnpm', ['--filter', '@yuer/web', 'dev'], {
  cwd: process.cwd(),
  detached: true,
  shell: true,
  stdio: ['ignore', out, out],
});
writeFileSync('tmp-dev-logs/preview-dev.pid', String(child.pid));
child.unref();
console.log(`dev server spawning, pid ${child.pid}`);
