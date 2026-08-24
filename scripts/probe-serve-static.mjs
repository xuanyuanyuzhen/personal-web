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

/**
 * 模拟「经 Cloudflare 转发」的请求头。Cloudflare 对每个转发请求都注入
 * CF-Connecting-IP，代码里的 shouldBlockFromPublicNetwork 就是靠它区分
 * 公网来源和本机直连。
 */
const CF = { 'CF-Connecting-IP': '203.0.113.5' };

/** [路径, Accept, 方法, 期望状态, 期望是否为 HTML, 说明, 额外请求头] */
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

  // ——— 本机直连：后台面板必须能用（无 CF-Connecting-IP）———
  // 401 = 中间件放行、走到了 AdminAuthGuard（没带 cookie 所以拒绝）。
  // 若这里变成 404，说明加固把本机也拦了，后台会彻底进不去。
  ['/api/auth/me', '*/*', 'GET', 401, false, '本机: 登录态检查可达'],
  ['/api/admin/essays', '*/*', 'GET', 401, false, '本机: 管理端可达'],

  // ——— 模拟公网来源：带 CF-Connecting-IP，管理端与登录应全部 404 ———
  ['/api/auth/login', '*/*', 'POST', 404, false, '公网: 登录被拦', CF],
  ['/api/auth/me', '*/*', 'GET', 404, false, '公网: 登录态检查被拦', CF],
  ['/api/auth/change-password', '*/*', 'POST', 404, false, '公网: 改密码被拦', CF],
  ['/api/admin/essays', '*/*', 'GET', 404, false, '公网: 管理端被拦', CF],
  ['/api/admin/settings', '*/*', 'PUT', 404, false, '公网: 站点设置被拦', CF],

  // ——— 公网来源：前台要用的端点必须照常可用 ———
  ['/', 'text/html', 'GET', 200, true, '公网: 首页正常', CF],
  ['/api/health', '*/*', 'GET', 200, false, '公网: 健康检查正常', CF],
  ['/api/essays/public', '*/*', 'GET', 200, false, '公网: 随笔列表正常', CF],
  ['/api/thoughts/public', '*/*', 'GET', 200, false, '公网: 碎碎念列表正常', CF],
  ['/api/site/settings', '*/*', 'GET', 200, false, '公网: 站点设置读取正常', CF],
];

function looksLikeHtml(body) {
  const head = body.trimStart().slice(0, 200).toLowerCase();

  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

const results = [];

for (const [path, accept, method, wantStatus, wantHtml, label, extraHeaders] of CASES) {
  let status = 'ERR';
  let isHtml = false;
  let detail = '';

  try {
    const response = await fetch(BASE + path, {
      method,
      headers: { Accept: accept, ...extraHeaders },
    });
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
