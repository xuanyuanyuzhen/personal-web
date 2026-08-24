import { Request } from 'express';

/**
 * 只允许本机直连访问的路径前缀。
 *
 * 后台管理面板不对公网暴露（走 `localhost:5174` 的 Vite dev proxy 直连
 * `127.0.0.1:3000`），所以这些端点从公网访问一律没有正当用途：
 *
 * - `/api/admin/*` —— 全部管理端 CRUD。
 * - `/api/auth/*` —— 登录、登出、改密码。**这条尤其重要**：登录端点不在
 *   `/api/admin/` 下，只拦前者的话攻击者照样能对着它爆破密码。
 */
const LOCAL_ONLY_PREFIXES = ['/api/admin', '/api/auth'];

/**
 * 请求是否经由 Cloudflare 转发而来（即来自公网）。
 *
 * 判据是 `CF-Connecting-IP`：Cloudflare 对每个转发请求都会注入它，且会覆盖
 * 客户端自己塞的值，所以伪造不了、也去不掉。
 *
 * ⚠️ 不能用 socket 地址来判断。`cloudflared` 跑在同一台机器上，它连的就是
 * `127.0.0.1:3000` —— 隧道流量和本机后台流量的 `remoteAddress` **都是**
 * 127.0.0.1，区分不开。这是本文件存在的核心原因。
 *
 * ⚠️ 如果将来把入口从 Cloudflare 换成别的东西（nginx、frp 等），这个头就不再
 * 出现，管理端会**静默地重新暴露到公网**。换入口时必须同步改这里，否则这道
 * 防线会无声消失。
 */
function isForwardedFromPublicNetwork(request: Request): boolean {
  return request.headers['cf-connecting-ip'] !== undefined;
}

function isLocalOnlyPath(path: string): boolean {
  return LOCAL_ONLY_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * 该请求是否应当被拒绝：公网来源 + 访问仅限本机的路径。
 *
 * 与 Cloudflare 侧的 WAF 规则是双重防护。WAF 规则住在控制台里，被误删或换部署
 * 方式时会静默失效；这份判断跟着代码走，有测试覆盖。
 */
export function shouldBlockFromPublicNetwork(request: Request): boolean {
  return isForwardedFromPublicNetwork(request) && isLocalOnlyPath(request.path);
}
