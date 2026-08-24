import { Request } from 'express';
import { shouldBlockFromPublicNetwork } from '../src/common/local-only';

function createRequest(path: string, headers: Record<string, string> = {}): Request {
  return { headers, path } as unknown as Request;
}

/** 经 Cloudflare 转发的请求：CF-Connecting-IP 由边缘注入。 */
function fromPublicNetwork(path: string): Request {
  return createRequest(path, { 'cf-connecting-ip': '203.0.113.5' });
}

/** 本机直连（后台面板经 Vite proxy 打到 127.0.0.1:3000）：没有这个头。 */
function fromLocalhost(path: string): Request {
  return createRequest(path);
}

describe('shouldBlockFromPublicNetwork', () => {
  it('blocks the login endpoint, not just /api/admin', () => {
    // 这是本文件最重要的一条。/api/auth/login 不在 /api/admin/ 下面，
    // 只拦后者的话，攻击者照样能对着登录接口爆破密码。
    expect(shouldBlockFromPublicNetwork(fromPublicNetwork('/api/auth/login'))).toBe(true);
  });

  it('blocks every local-only prefix from the public network', () => {
    const blocked = [
      '/api/admin',
      '/api/admin/essays',
      '/api/admin/settings/avatar',
      '/api/admin/uploads/photo',
      '/api/auth',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/change-password',
    ];

    for (const path of blocked) {
      expect(shouldBlockFromPublicNetwork(fromPublicNetwork(path))).toBe(true);
    }
  });

  it('lets the local admin panel through on those same paths', () => {
    // 后台走 localhost:5174 → Vite proxy → 127.0.0.1:3000，不经 Cloudflare，
    // 所以没有 CF-Connecting-IP。这条保证加固不会把用户自己锁在门外。
    const allowed = ['/api/admin/essays', '/api/auth/login', '/api/auth/change-password'];

    for (const path of allowed) {
      expect(shouldBlockFromPublicNetwork(fromLocalhost(path))).toBe(false);
    }
  });

  it('leaves public endpoints reachable from the public network', () => {
    // 前台要用这些，拦了站点就废了。
    const publicPaths = [
      '/',
      '/essays/some-slug',
      '/api/health',
      '/api/essays/public',
      '/api/thoughts/public',
      '/api/messages',
      '/api/messages/public',
      '/api/comments',
      '/api/likes/toggle',
      '/api/site/settings',
      '/api/search/public',
      '/api/statistics/visit',
      '/uploads/photos/large/2026/08/x.jpg',
    ];

    for (const path of publicPaths) {
      expect(shouldBlockFromPublicNetwork(fromPublicNetwork(path))).toBe(false);
    }
  });

  it('does not block paths that merely start with the same characters', () => {
    // /api/administrators 之类的路径不该被前缀匹配误伤。
    expect(shouldBlockFromPublicNetwork(fromPublicNetwork('/api/administrators'))).toBe(false);
    expect(shouldBlockFromPublicNetwork(fromPublicNetwork('/api/authors'))).toBe(false);
    expect(shouldBlockFromPublicNetwork(fromPublicNetwork('/api/authorize-public'))).toBe(false);
  });

  it('blocks regardless of the CF-Connecting-IP value', () => {
    // 只看头存不存在，不看值 —— 值是真实客户端 IP，可以是任何东西。
    expect(
      shouldBlockFromPublicNetwork(createRequest('/api/auth/login', { 'cf-connecting-ip': '' })),
    ).toBe(true);
  });

  it('is not fooled by a client-supplied X-Forwarded-For', () => {
    // 攻击者能伪造 XFF，但伪造不了 CF-Connecting-IP（Cloudflare 会覆盖它）。
    // 反过来说，本机请求即便带上 XFF 也不该被误拦。
    expect(
      shouldBlockFromPublicNetwork(
        createRequest('/api/auth/login', { 'x-forwarded-for': '203.0.113.5' }),
      ),
    ).toBe(false);
  });
});
