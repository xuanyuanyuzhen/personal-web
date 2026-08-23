import { Request } from 'express';

/**
 * 解析请求的客户端 IP，用于限流计数与登录审计。
 *
 * `CF-Connecting-IP` 必须排在最前，这是安全属性而不是偏好：
 *
 * - Cloudflare 会无条件用真实连接 IP **覆盖** 这个头，客户端伪造不了。
 * - `X-Forwarded-For` 的第一段却是**客户端可控**的：代理只往末尾追加，不会清理
 *   客户端自己塞进来的值。谁都能每次请求换一个假 IP，让限流按「不同来源」计数，
 *   等于把 `auth.controller.ts:35` 的登录限流（5 分钟 10 次）变成无限次密码爆破。
 *
 * 其余顺序保持原样，好让 nginx 之类会设置 `X-Forwarded-For` / `X-Real-IP` 的
 * 反向代理部署行为不变。
 *
 * ⚠️ 换成 Cloudflare 之外的入口时，必须确认新入口同样会覆盖（而不是追加）它注入的
 * 那个头，否则这里会退回到可伪造状态。
 */
export function getRequestIp(request: Request): string | undefined {
  // 只有这个头是不可伪造的，所以它优先于下面所有客户端可控的来源。
  const connectingIp = headerValue(request.headers['cf-connecting-ip'])?.trim();
  if (connectingIp) {
    return connectingIp;
  }

  const forwardedFor = headerValue(request.headers['x-forwarded-for']);
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return (
    headerValue(request.headers['x-real-ip']) ??
    request.ip ??
    request.socket.remoteAddress ??
    undefined
  );
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
