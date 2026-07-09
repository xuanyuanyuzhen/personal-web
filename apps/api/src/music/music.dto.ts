import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MusicQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: '春日' })
  search?: string;
}

export class CreateMusicDto {
  @ApiProperty({ example: '春日散步' })
  title!: string;

  @ApiProperty({ example: '语尔' })
  artist!: string;

  @ApiPropertyOptional({ example: '/uploads/music/song.mp3' })
  localUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/song.mp3' })
  externalUrl?: string | null;

  @ApiPropertyOptional({ example: '[00:00.00]春日散步' })
  lyricText?: string | null;

  @ApiPropertyOptional({ example: '/uploads/music/song.lrc' })
  lyricFileUrl?: string | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class UpdateMusicDto {
  @ApiPropertyOptional({ example: '春日散步' })
  title?: string;

  @ApiPropertyOptional({ example: '语尔' })
  artist?: string;

  @ApiPropertyOptional({ example: '/uploads/music/song.mp3' })
  localUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com/song.mp3' })
  externalUrl?: string | null;

  @ApiPropertyOptional({ example: '[00:00.00]春日散步' })
  lyricText?: string | null;

  @ApiPropertyOptional({ example: '/uploads/music/song.lrc' })
  lyricFileUrl?: string | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}
