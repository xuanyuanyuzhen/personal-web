import { Request } from 'express';
import { getRequestIp } from '../src/auth/request-ip';

function createRequest(
  headers: Record<string, string | string[]>,
  socketAddress = '10.0.0.1',
): Request {
  return {
    headers,
    ip: undefined,
    socket: { remoteAddress: socketAddress },
  } as unknown as Request;
}

describe('getRequestIp', () => {
  it('prefers CF-Connecting-IP over a client-supplied X-Forwarded-For', () => {
    // 这是限流的安全前提：Cloudflare 覆盖 CF-Connecting-IP，但只往 XFF 末尾追加，
    // 所以 XFF 的第一段是攻击者可控的。一旦 XFF 赢了，攻击者每次换一个假 IP
    // 就能绕过登录限流做无限次爆破。
    const request = createRequest({
      'cf-connecting-ip': '203.0.113.5',
      'x-forwarded-for': '1.2.3.4, 203.0.113.5',
    });

    expect(getRequestIp(request)).toBe('203.0.113.5');
  });

  it('gives the same value for every forged X-Forwarded-For from one client', () => {
    // 限流按返回值分桶，所以同一个真实客户端伪造不同 XFF 必须仍落在同一个桶里。
    const first = getRequestIp(
      createRequest({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': '-1' }),
    );
    const second = getRequestIp(
      createRequest({ 'cf-connecting-ip': '203.0.113.5', 'x-forwarded-for': 'fake-2' }),
    );

    expect(first).toBe(second);
  });

  it('ignores a blank CF-Connecting-IP instead of returning an empty string', () => {
    const request = createRequest({
      'cf-connecting-ip': '   ',
      'x-forwarded-for': '198.51.100.7',
    });

    expect(getRequestIp(request)).toBe('198.51.100.7');
  });

  it('falls back to the first X-Forwarded-For hop when Cloudflare is absent', () => {
    // nginx 之类的反向代理部署行为保持不变。
    const request = createRequest({ 'x-forwarded-for': '198.51.100.7, 10.0.0.1' });

    expect(getRequestIp(request)).toBe('198.51.100.7');
  });

  it('falls back to X-Real-IP, then the socket address', () => {
    expect(getRequestIp(createRequest({ 'x-real-ip': '198.51.100.8' }))).toBe('198.51.100.8');
    expect(getRequestIp(createRequest({}, '192.0.2.44'))).toBe('192.0.2.44');
  });

  it('reads the first entry when a header arrives repeated', () => {
    const request = createRequest({ 'cf-connecting-ip': ['203.0.113.5', '1.2.3.4'] });

    expect(getRequestIp(request)).toBe('203.0.113.5');
  });
});
