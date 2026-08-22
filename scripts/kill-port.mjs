// 按端口清理残留的本地 dev server 进程(取 LISTENING 行的 PID,按进程树终止)。
// 用法: node scripts/kill-port.mjs 5173 5174
import { execSync } from 'node:child_process';

for (const port of process.argv.slice(2)) {
  let output = '';
  try {
    output = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`).toString();
  } catch {
    console.log(`port ${port}: free`);
    continue;
  }

  const pids = new Set(
    output
      .trim()
      .split('\n')
      .filter((line) => line.includes(`:${port} `))
      .map((line) => line.trim().split(/\s+/).pop())
      .filter((pid) => pid && pid !== '0'),
  );

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      console.log(`port ${port}: killed pid ${pid}`);
    } catch {
      console.log(`port ${port}: pid ${pid} already gone`);
    }
  }
}
