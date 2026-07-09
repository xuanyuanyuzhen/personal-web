import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus, Visibility } from '@prisma/client';

export class PageQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'about' })
  search?: string;
}

export class CreatePageDto {
  @ApiProperty({ example: 'About' })
  title!: string;

  @ApiProperty({ example: 'about' })
  slug!: string;

  @ApiPropertyOptional({ example: 'Short page summary' })
  summary?: string | null;

  @ApiProperty({ example: '<p>Hello</p>' })
  content!: string;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 'SEO title' })
  seoTitle?: string | null;

  @ApiPropertyOptional({ example: 'SEO description' })
  seoDescription?: string | null;

  @ApiPropertyOptional({ example: 'about,site' })
  seoKeywords?: string | null;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;
}

export class UpdatePageDto {
  @ApiPropertyOptional({ example: 'About' })
  title?: string;

  @ApiPropertyOptional({ example: 'about' })
  slug?: string;

  @ApiPropertyOptional({ example: 'Short page summary' })
  summary?: string | null;

  @ApiPropertyOptional({ example: '<p>Hello</p>' })
  content?: string;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 'SEO title' })
  seoTitle?: string | null;

  @ApiPropertyOptional({ example: 'SEO description' })
  seoDescription?: string | null;

  @ApiPropertyOptional({ example: 'about,site' })
  seoKeywords?: string | null;

  @ApiPropertyOptional({ example: false })
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;
}
