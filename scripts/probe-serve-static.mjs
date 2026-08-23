/**
 * 生产模式路由冒烟：验证 API 单进程同时托管前台后，各类路径的响应是否正确。
 *
 * 用法（先起 `pnpm --filter @yuer/api start`）：
 *   pnpm exec node scripts/probe-serve-static.mjs
 *
 * 关注四件事：
 *   1. /api/* 仍然走 Nest 路由，没被 SPA fallback 吞掉；
 *   2. / 和深链接（/essays/xxx）都返回 index.html，刷新不 404；
 *   3. 生产环境 /api/docs 已关闭；
 *   4. 缺失的静态资源照常 404，而不是拿到 200 + 一坨 HTML。
 */

const BASE = process.env.PROBE_BASE_URL?.trim() || 'http://127.0.0.1:3000';

/** [路径, Accept, 方法, 期望状态, 期望是否为 HTML, 说明] */
const CASES = [
  ['/api/health', 'text/html', 'GET', 200, false, 'API 健康检查'],
  ['/', 'text/html', 'GET', 200, true, '首页返回 index.html'],
  ['/essays/some-slug', 'text/html', 'GET', 200, true, '深链接刷新兜底'],
  ['/thoughts', 'text/html', 'GET', 200, true, '内页刷新兜底'],
  ['/api/docs', 'text/html', 'GET', 404, false, '生产环境 Swagger 已关'],
  ['/api/nonexistent', 'text/html', 'GET', 404, false, '未知 API 不被 SPA 吞掉'],
  ['/api/nonexistent', 'text/html', 'POST', 404, false, '非 GET 的未知 API'],
  ['/assets/nope.js', '*/*', 'GET', 404, false, '缺失资源照常 404'],
  ['/assets/nope.css', 'text/css', 'GET', 404, false, '缺失样式照常 404'],
  ['/bg/home.jpg', '*/*', 'GET', 200, false, '真实存在的静态资源'],
  ['/uploads/nope.png', '*/*', 'GET', 404, false, '缺失上传文件照常 404'],
];

function looksLikeHtml(body) {
  const head = body.trimStart().slice(0, 200).toLowerCase();

  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

const results = [];

for (const [path, accept, method, wantStatus, wantHtml, label] of CASES) {
  let status = 'ERR';
  let isHtml = false;
  let detail = '';

  try {
    const response = await fetch(BASE + path, { method, headers: { Accept: accept } });
    const body = await response.text();
    status = response.status;
    isHtml = looksLikeHtml(body);
    detail = `len=${body.length}`;
  } catch (error) {
    detail = error.message;
  }

  const ok = status === wantStatus && isHtml === wantHtml;
  results.push({ ok, label, method, path, status, wantStatus, isHtml, wantHtml, detail });
}

let failed = 0;
for (const r of results) {
  if (!r.ok) {
    failed += 1;
  }
  const mark = r.ok ? 'PASS' : 'FAIL';
  const html = r.isHtml ? 'HTML' : 'non-HTML';
  const want = r.ok ? '' : `  (want ${r.wantStatus} ${r.wantHtml ? 'HTML' : 'non-HTML'})`;
  console.log(
    `${mark}  ${r.method.padEnd(4)} ${r.path.padEnd(20)} ${String(r.status).padEnd(4)} ${html.padEnd(9)} ${r.detail}${want}   ${r.label}`,
  );
}

console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
