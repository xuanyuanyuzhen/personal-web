import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OperationType } from '@prisma/client';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_EXPIRES_IN_SECONDS } from './auth.constants';
import { AuthTokenService } from './auth-token.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { AuthenticatedAdmin } from './auth.types';
import { PasswordService } from './password.service';

const adminSelect = {
  id: true,
  username: true,
  passwordHash: true,
  passwordVersion: true,
  displayName: true,
  lastLoginAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: AuthTokenService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<{
    admin: AuthenticatedAdmin;
    token: string;
    expiresInSeconds: number;
  }> {
    this.assertLoginInput(dto);

    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
      select: adminSelect,
    });

    if (!admin || !(await this.passwordService.verify(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const updatedAdmin = await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
      select: adminSelect,
    });
    const publicAdmin = this.toPublicAdmin(updatedAdmin);
    const expiresInSeconds = dto.rememberMe
      ? AUTH_EXPIRES_IN_SECONDS.rememberMe
      : AUTH_EXPIRES_IN_SECONDS.default;
    const token = this.tokenService.sign(
      {
        sub: publicAdmin.id,
        adminId: publicAdmin.id,
        username: publicAdmin.username,
        passwordVersion: publicAdmin.passwordVersion,
      },
      expiresInSeconds,
    );

    await this.operationLogService.write({
      adminId: publicAdmin.id,
      action: OperationType.LOGIN,
      ip,
      detail: {
        username: publicAdmin.username,
        rememberMe: Boolean(dto.rememberMe),
        expiresInSeconds,
      },
    });

    return {
      admin: publicAdmin,
      token,
      expiresInSeconds,
    };
  }

  async findAuthenticatedAdmin(adminId: number): Promise<AuthenticatedAdmin | undefined> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: adminSelect,
    });

    return admin ? this.toPublicAdmin(admin) : undefined;
  }

  async changePassword(
    admin: AuthenticatedAdmin,
    dto: ChangePasswordDto,
    ip?: string,
  ): Promise<{ ok: true }> {
    this.assertPasswordInput(dto);

    const currentAdmin = await this.prisma.admin.findUnique({
      where: { id: admin.id },
      select: adminSelect,
    });

    if (
      !currentAdmin ||
      !(await this.passwordService.verify(dto.currentPassword, currentAdmin.passwordHash))
    ) {
      throw new UnauthorizedException('Old password is incorrect.');
    }

    const passwordHash = await this.passwordService.createHash(dto.newPassword);
    const updatedAdmin = await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        passwordVersion: {
          increment: 1,
        },
      },
      select: adminSelect,
    });

    await this.operationLogService.write({
      adminId: updatedAdmin.id,
      action: OperationType.CHANGE_PASSWORD,
      ip,
      detail: {
        username: updatedAdmin.username,
        passwordVersion: updatedAdmin.passwordVersion,
      },
    });

    return { ok: true };
  }

  private toPublicAdmin(admin: {
    id: number;
    username: string;
    passwordVersion: number;
    displayName: string;
    lastLoginAt: Date | null;
  }): AuthenticatedAdmin {
    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      passwordVersion: admin.passwordVersion,
      lastLoginAt: admin.lastLoginAt,
    };
  }

  private assertLoginInput(dto: LoginDto): void {
    if (!dto?.username?.trim() || !dto?.password) {
      throw new UnauthorizedException('Invalid username or password.');
    }
  }

  private assertPasswordInput(dto: ChangePasswordDto): void {
    if (!dto?.currentPassword || !dto?.newPassword || dto.newPassword.length < 8) {
      throw new UnauthorizedException('Password input is invalid.');
    }
  }
}
