import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MascotPublicQueryDto {
  @ApiPropertyOptional({ example: 'home' })
  pageKey?: string;
}

export class UpdateMascotConfigDto {
  @ApiPropertyOptional({ example: '默认看板娘' })
  name?: string;

  @ApiPropertyOptional({ example: '/uploads/site/mascot/placeholder.png' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: ['*'] })
  displayScopes?: string[];

  @ApiPropertyOptional({ example: { reserved: true } })
  live2dConfig?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class CreateMascotLineDto {
  @ApiPropertyOptional({ example: 'default-home' })
  key?: string;

  @ApiProperty({ example: 'home' })
  pageKey!: string;

  @ApiProperty({ example: '欢迎回来，今天也慢慢记录吧。' })
  content!: string;

  @ApiPropertyOptional({ example: 5 })
  weight?: number;

  @ApiPropertyOptional({ example: false })
  isRandom?: boolean;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;
}

export class UpdateMascotLineDto {
  @ApiPropertyOptional({ example: 'home' })
  pageKey?: string;

  @ApiPropertyOptional({ example: '欢迎回来，今天也慢慢记录吧。' })
  content?: string;

  @ApiPropertyOptional({ example: 5 })
  weight?: number;

  @ApiPropertyOptional({ example: false })
  isRandom?: boolean;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;
}
