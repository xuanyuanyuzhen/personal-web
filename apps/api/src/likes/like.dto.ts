import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleLikeDto {
  @ApiProperty({ enum: ['site', 'thought', 'essay', 'photo'], example: 'site' })
  targetType!: string;

  @ApiPropertyOptional({ example: 'site' })
  targetId?: string;
}

export class LikeStatusQueryDto {
  @ApiProperty({ enum: ['site', 'thought', 'essay', 'photo'], example: 'site' })
  targetType!: string;

  @ApiPropertyOptional({ example: 'site' })
  targetId?: string;
}
