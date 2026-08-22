// 停掉 preview-dev-server.mjs 拉起的 dev server(按 pid 树终止)。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

const pidFile = 'tmp-dev-logs/preview-dev.pid';
if (!existsSync(pidFile)) {
  console.log('no pid file, nothing to stop');
  process.exit(0);
}

const pid = readFileSync(pidFile, 'utf8').trim();
try {
  execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'inherit' });
} catch {
  console.log(`taskkill for pid ${pid} failed (probably already exited)`);
}
rmSync(pidFile, { force: true });
