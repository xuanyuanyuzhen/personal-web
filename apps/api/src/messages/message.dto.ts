import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditStatus, BlacklistType, ForbiddenRuleType } from '@prisma/client';

export class ListMessageDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'hello' })
  search?: string;

  @ApiPropertyOptional({ enum: AuditStatus, example: AuditStatus.PENDING })
  status?: AuditStatus;
}

export class CreateMessageDto {
  @ApiProperty({ example: '小语' })
  nickname!: string;

  @ApiProperty({ example: 'hello@example.com' })
  email!: string;

  @ApiProperty({ example: '来留言啦。' })
  content!: string;
}

export class AuditMessageDto {
  @ApiProperty({ enum: AuditStatus, example: AuditStatus.APPROVED })
  status!: AuditStatus;

  @ApiPropertyOptional({ example: '内容正常' })
  reason?: string | null;
}

export class ListModerationDto {
  @ApiPropertyOptional({ example: 1 })
  page?: string;

  @ApiPropertyOptional({ example: 20 })
  pageSize?: string;

  @ApiPropertyOptional({ example: 'spam' })
  search?: string;
}

export class CreateForbiddenWordDto {
  @ApiProperty({ example: 'spam' })
  word!: string;

  @ApiPropertyOptional({ enum: ForbiddenRuleType, example: ForbiddenRuleType.PLAIN })
  ruleType?: ForbiddenRuleType;

  @ApiPropertyOptional({ example: '广告词' })
  note?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class CreateCommentDto {
  @ApiProperty({ example: 1 })
  essayId!: number;

  @ApiPropertyOptional({ example: 1 })
  parentId?: number | null;

  @ApiProperty({ example: '小语' })
  nickname!: string;

  @ApiProperty({ example: 'hello@example.com' })
  email!: string;

  @ApiProperty({ example: '这篇随笔很有共鸣。' })
  content!: string;
}

export class ListCommentDto extends ListMessageDto {
  @ApiPropertyOptional({ example: 1 })
  essayId?: string;
}

export class UpdateCommentDto {
  @ApiPropertyOptional({ example: '小语' })
  nickname?: string;

  @ApiPropertyOptional({ example: 'hello@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '更新后的评论内容。' })
  content?: string;
}

export class ReplyCommentDto {
  @ApiProperty({ example: '感谢你的留言。' })
  content!: string;
}

export class UpdateForbiddenWordDto {
  @ApiPropertyOptional({ example: 'spam' })
  word?: string;

  @ApiPropertyOptional({ enum: ForbiddenRuleType, example: ForbiddenRuleType.PLAIN })
  ruleType?: ForbiddenRuleType;

  @ApiPropertyOptional({ example: '广告词' })
  note?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class CreateBlacklistItemDto {
  @ApiProperty({ enum: BlacklistType, example: BlacklistType.EMAIL })
  type!: BlacklistType;

  @ApiProperty({ example: 'blocked@example.com' })
  value!: string;

  @ApiPropertyOptional({ example: '手动加入' })
  note?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}

export class UpdateBlacklistItemDto {
  @ApiPropertyOptional({ enum: BlacklistType, example: BlacklistType.EMAIL })
  type?: BlacklistType;

  @ApiPropertyOptional({ example: 'blocked@example.com' })
  value?: string;

  @ApiPropertyOptional({ example: '手动加入' })
  note?: string | null;

  @ApiPropertyOptional({ example: true })
  isEnabled?: boolean;
}
