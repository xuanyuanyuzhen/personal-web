import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { AuthenticatedRequest } from './auth.types';
import { readCookie } from './cookie';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: AuthTokenService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readCookie(request, AUTH_COOKIE_NAME);
    if (!token) {
      throw new UnauthorizedException('Authentication required.');
    }

    const payload = this.tokenService.verify(token);
    const admin = await this.authService.findAuthenticatedAdmin(payload.adminId);
    if (
      !admin ||
      admin.id !== payload.adminId ||
      admin.username !== payload.username ||
      admin.passwordVersion !== payload.passwordVersion
    ) {
      throw new UnauthorizedException('Authentication token is no longer valid.');
    }

    (request as AuthenticatedRequest).admin = admin;

    return true;
  }
}
