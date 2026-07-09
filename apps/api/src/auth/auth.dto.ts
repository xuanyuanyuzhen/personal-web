import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  username!: string;

  @ApiProperty({ example: 'admin123' })
  password!: string;

  @ApiPropertyOptional({ example: false })
  rememberMe?: boolean;
}

export class ChangePasswordDto {
  @ApiProperty()
  currentPassword!: string;

  @ApiProperty()
  newPassword!: string;
}

export class AdminProfileDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty()
  passwordVersion!: number;

  @ApiProperty({ required: false, nullable: true })
  lastLoginAt!: Date | null;
}

export class AuthResponseDto {
  @ApiProperty({ type: AdminProfileDto })
  admin!: AdminProfileDto;

  @ApiProperty()
  expiresInSeconds!: number;
}

export class OkResponseDto {
  @ApiProperty()
  ok!: boolean;
}
