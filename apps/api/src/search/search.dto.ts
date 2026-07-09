import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicSearchQueryDto {
  @ApiProperty({ example: '春日' })
  q!: string;

  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 5 })
  pageSize?: string;
}
