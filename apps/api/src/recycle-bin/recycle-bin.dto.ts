import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecycleBinQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'THOUGHT' })
  objectType?: string;

  @ApiPropertyOptional({ example: '春日' })
  search?: string;
}

export class OperationLogQueryDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'DELETE' })
  action?: string;

  @ApiPropertyOptional({ example: 'THOUGHT' })
  objectType?: string;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  search?: string;
}
