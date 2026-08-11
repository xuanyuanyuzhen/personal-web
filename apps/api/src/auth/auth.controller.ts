import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { useSecureCookie } from '../config/env';
import { AUTH_COOKIE_NAME } from './auth.constants';
import { AdminAuthGuard } from './admin-auth.guard';
import { AuthService } from './auth.service';
import {
  AdminProfileDto,
  AuthResponseDto,
  ChangePasswordDto,
  LoginDto,
  OkResponseDto,
} from './auth.dto';
import { AuthenticatedRequest } from './auth.types';
import { getRequestIp } from './request-ip';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 5 * 60 * 1000 })
  @ApiOperation({ summary: 'Admin username and password login.' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts.' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password.' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, getRequestIp(request));

    response.cookie(AUTH_COOKIE_NAME, result.token, {
      ...cookieOptions(),
      maxAge: result.expiresInSeconds * 1000,
    });

    return {
      admin: result.admin,
      expiresInSeconds: result.expiresInSeconds,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the admin login cookie.' })
  @ApiOkResponse({ type: OkResponseDto })
  logout(@Res({ passthrough: true }) response: Response): OkResponseDto {
    response.clearCookie(AUTH_COOKIE_NAME, cookieOptions());

    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Get current admin profile.' })
  @ApiOkResponse({ type: AdminProfileDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  me(@Req() request: AuthenticatedRequest): AdminProfileDto {
    return request.admin;
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ summary: 'Change current admin password.' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ type: OkResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required or old password is invalid.' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<OkResponseDto> {
    return this.authService.changePassword(request.admin, dto, getRequestIp(request));
  }
}

function cookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    // 依据显式配置而不是 NODE_ENV：启动链路里从未设置 NODE_ENV，
    // 之前会让生产环境静默退化成明文 cookie。
    secure: useSecureCookie(),
    path: '/',
  };
}
