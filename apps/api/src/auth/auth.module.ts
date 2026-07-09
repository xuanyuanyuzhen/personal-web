import { Module } from '@nestjs/common';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminPreviewGuard } from './admin-preview.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { PasswordService } from './password.service';

@Module({
  imports: [OperationLogModule],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService, PasswordService, AdminAuthGuard, AdminPreviewGuard],
  exports: [AuthService, AuthTokenService, PasswordService, AdminAuthGuard, AdminPreviewGuard],
})
export class AuthModule {}
