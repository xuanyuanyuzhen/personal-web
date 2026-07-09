import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetType } from '@prisma/client';

export class TagQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'daily' })
  search?: string;

  @ApiPropertyOptional({ enum: TargetType, example: TargetType.THOUGHT })
  scope?: TargetType;

  @ApiPropertyOptional({ example: true })
  isEnabled?: string;
}

export class PublicTagQueryDto {
  @ApiPropertyOptional({ enum: TargetType, example: TargetType.THOUGHT })
  scope?: TargetType;
}

export class CreateTagDto {
  @ApiProperty({ example: '日常' })
  name!: string;

  @ApiProperty({ example: 'daily' })
  slug!: string;

  @ApiPropertyOptional({ example: '#c45b80' })
  color?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;

  @ApiProperty({ enum: TargetType, isArray: true, example: [TargetType.THOUGHT, TargetType.ESSAY] })
  scopes!: TargetType[];
}

export class UpdateTagDto {
  @ApiPropertyOptional({ example: '日常' })
  name?: string;

  @ApiPropertyOptional({ example: 'daily' })
  slug?: string;

  @ApiPropertyOptional({ example: '#c45b80' })
  color?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: TargetType, isArray: true, example: [TargetType.THOUGHT, TargetType.ESSAY] })
  scopes?: TargetType[];
}
