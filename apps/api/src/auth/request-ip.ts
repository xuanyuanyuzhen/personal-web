import { Request } from 'express';

export function getRequestIp(request: Request): string | undefined {
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
