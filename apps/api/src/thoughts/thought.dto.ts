import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus, Visibility } from '@prisma/client';

export class ThoughtQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'daily' })
  search?: string;

  @ApiPropertyOptional({ example: 'daily' })
  tag?: string;
}

export class CreateThoughtDto {
  @ApiProperty({ example: '<p>今天也慢慢记录。</p>' })
  content!: string;

  @ApiPropertyOptional({ example: '今天也慢慢记录。' })
  summary?: string | null;

  @ApiPropertyOptional({ example: '/uploads/thoughts/image.png' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['日常', '灵感'] })
  tagNames?: string[];
}

export class UpdateThoughtDto {
  @ApiPropertyOptional({ example: '<p>今天也慢慢记录。</p>' })
  content?: string;

  @ApiPropertyOptional({ example: '今天也慢慢记录。' })
  summary?: string | null;

  @ApiPropertyOptional({ example: '/uploads/thoughts/image.png' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: ['日常', '灵感'] })
  tagNames?: string[];
}
