import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordVisitDto {
  @ApiProperty({ example: '/thoughts' })
  path!: string;

  @ApiPropertyOptional({ example: 'thought' })
  pageType?: string;

  @ApiPropertyOptional({ example: '12' })
  pageId?: string | null;
}
