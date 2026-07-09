import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus, Visibility } from '@prisma/client';

export class EssayQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'daily' })
  search?: string;

  @ApiPropertyOptional({ example: 'notes' })
  category?: string;

  @ApiPropertyOptional({ example: 'daily' })
  tag?: string;
}

export class CreateEssayCategoryDto {
  @ApiProperty({ example: '日常随笔' })
  name!: string;

  @ApiProperty({ example: 'daily-essays' })
  slug!: string;

  @ApiPropertyOptional({ example: '松散记录与长一点的想法。' })
  description?: string | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class UpdateEssayCategoryDto {
  @ApiPropertyOptional({ example: '日常随笔' })
  name?: string;

  @ApiPropertyOptional({ example: 'daily-essays' })
  slug?: string;

  @ApiPropertyOptional({ example: '松散记录与长一点的想法。' })
  description?: string | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class CreateEssayDto {
  @ApiProperty({ example: '春日手记' })
  title!: string;

  @ApiProperty({ example: 'spring-note' })
  slug!: string;

  @ApiPropertyOptional({ example: '一个短摘要。' })
  summary?: string | null;

  @ApiProperty({ example: '<p>慢慢写下一些想法。</p>' })
  content!: string;

  @ApiPropertyOptional({ example: '/uploads/essays/cover.png' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ example: 1 })
  categoryId?: number | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['日常', '记录'] })
  tagNames?: string[];
}

export class UpdateEssayDto {
  @ApiPropertyOptional({ example: '春日手记' })
  title?: string;

  @ApiPropertyOptional({ example: 'spring-note' })
  slug?: string;

  @ApiPropertyOptional({ example: '一个短摘要。' })
  summary?: string | null;

  @ApiPropertyOptional({ example: '<p>慢慢写下一些想法。</p>' })
  content?: string;

  @ApiPropertyOptional({ example: '/uploads/essays/cover.png' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ example: 1 })
  categoryId?: number | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['日常', '记录'] })
  tagNames?: string[];
}
