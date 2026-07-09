import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NavigationType } from '@prisma/client';

export class NavigationQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'about' })
  search?: string;
}

export class CreateNavigationDto {
  @ApiProperty({ example: 'about' })
  key!: string;

  @ApiProperty({ example: 'About' })
  title!: string;

  @ApiPropertyOptional({ enum: NavigationType, example: NavigationType.INTERNAL })
  type?: NavigationType;

  @ApiPropertyOptional({ example: '/about' })
  path?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com' })
  url?: string | null;

  @ApiPropertyOptional({ example: '_blank' })
  target?: string | null;

  @ApiPropertyOptional({ example: 'book-open' })
  icon?: string | null;

  @ApiPropertyOptional({ example: 1 })
  parentId?: number | null;

  @ApiPropertyOptional({ example: 1 })
  pageId?: number | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class UpdateNavigationDto {
  @ApiPropertyOptional({ example: 'about' })
  key?: string;

  @ApiPropertyOptional({ example: 'About' })
  title?: string;

  @ApiPropertyOptional({ enum: NavigationType, example: NavigationType.INTERNAL })
  type?: NavigationType;

  @ApiPropertyOptional({ example: '/about' })
  path?: string | null;

  @ApiPropertyOptional({ example: 'https://example.com' })
  url?: string | null;

  @ApiPropertyOptional({ example: '_blank' })
  target?: string | null;

  @ApiPropertyOptional({ example: 'book-open' })
  icon?: string | null;

  @ApiPropertyOptional({ example: 1 })
  parentId?: number | null;

  @ApiPropertyOptional({ example: 1 })
  pageId?: number | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}
