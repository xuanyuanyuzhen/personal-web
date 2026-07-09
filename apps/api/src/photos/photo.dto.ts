import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublishStatus, Visibility } from '@prisma/client';

export class PhotoQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'spring' })
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  albumId?: string;
}

export class CreateAlbumDto {
  @ApiProperty({ example: '春日相册' })
  name!: string;

  @ApiProperty({ example: 'spring' })
  slug!: string;

  @ApiPropertyOptional({ example: '慢慢收集春天。' })
  description?: string | null;

  @ApiPropertyOptional({ example: '/uploads/photos/thumb/2026/06/cover.jpg' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.PUBLISHED })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class UpdateAlbumDto {
  @ApiPropertyOptional({ example: '春日相册' })
  name?: string;

  @ApiPropertyOptional({ example: 'spring' })
  slug?: string;

  @ApiPropertyOptional({ example: '慢慢收集春天。' })
  description?: string | null;

  @ApiPropertyOptional({ example: '/uploads/photos/thumb/2026/06/cover.jpg' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.PUBLISHED })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class CreatePhotoDto {
  @ApiProperty({ example: '春日一角' })
  title!: string;

  @ApiPropertyOptional({ example: '阳光落在窗边。' })
  description?: string | null;

  @ApiProperty({ example: '/uploads/photos/original/2026/06/photo.jpg' })
  originalUrl!: string;

  @ApiPropertyOptional({ example: '/uploads/photos/large/2026/06/photo.jpg' })
  largeUrl?: string | null;

  @ApiPropertyOptional({ example: '/uploads/photos/thumb/2026/06/photo.jpg' })
  thumbUrl?: string | null;

  @ApiPropertyOptional({ example: 1 })
  albumId?: number | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.PUBLISHED })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number;
}

export class UpdatePhotoDto {
  @ApiPropertyOptional({ example: '春日一角' })
  title?: string;

  @ApiPropertyOptional({ example: '阳光落在窗边。' })
  description?: string | null;

  @ApiPropertyOptional({ example: '/uploads/photos/original/2026/06/photo.jpg' })
  originalUrl?: string;

  @ApiPropertyOptional({ example: '/uploads/photos/large/2026/06/photo.jpg' })
  largeUrl?: string | null;

  @ApiPropertyOptional({ example: '/uploads/photos/thumb/2026/06/photo.jpg' })
  thumbUrl?: string | null;

  @ApiPropertyOptional({ example: 1 })
  albumId?: number | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.PUBLISHED })
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Visibility, example: Visibility.PUBLIC })
  visibility?: Visibility;

  @ApiPropertyOptional({ example: 0 })
  sortOrder?: number;
}

export class SortPhotoItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 0 })
  sortOrder!: number;
}

export class SortPhotosDto {
  @ApiProperty({ type: [SortPhotoItemDto] })
  items!: SortPhotoItemDto[];
}
