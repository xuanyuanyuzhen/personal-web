import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditStatus,
  BlacklistType,
  ForbiddenRuleType,
  OperationType,
  Prisma,
  PublishStatus,
  TargetType,
  Visibility,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { OperationLogService } from '../operation-log/operation-log.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuditMessageDto,
  CreateCommentDto,
  CreateBlacklistItemDto,
  CreateForbiddenWordDto,
  CreateMessageDto,
  ListCommentDto,
  ListMessageDto,
  ReplyCommentDto,
  UpdateCommentDto,
  UpdateBlacklistItemDto,
  UpdateForbiddenWordDto,
} from './message.dto';

const messageSelect = {
  auditStatus: true,
  avatarUrl: true,
  blacklistMatched: true,
  content: true,
  createdAt: true,
  deletedAt: true,
  email: true,
  hitWords: true,
  id: true,
  nickname: true,
  updatedAt: true,
  visitorId: true,
} satisfies Prisma.MessageSelect;

const commentSelect = {
  auditStatus: true,
  blacklistMatched: true,
  content: true,
  createdAt: true,
  deletedAt: true,
  email: true,
  essay: {
    select: {
      id: true,
      slug: true,
      title: true,
    },
  },
  essayId: true,
  hitWords: true,
  id: true,
  nickname: true,
  parentId: true,
  updatedAt: true,
  visitorId: true,
} satisfies Prisma.CommentSelect;

// 审核规则同时服务留言和评论，保持命中词、黑名单和审核记录的行为一致。
const forbiddenWordSelect = {
  createdAt: true,
  id: true,
  isEnabled: true,
  note: true,
  ruleType: true,
  updatedAt: true,
  word: true,
} satisfies Prisma.ForbiddenWordSelect;

const blacklistItemSelect = {
  createdAt: true,
  id: true,
  isEnabled: true,
  note: true,
  type: true,
  updatedAt: true,
  value: true,
} satisfies Prisma.BlacklistItemSelect;

type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type MessageView = Omit<MessageRecord, 'deletedAt'>;
type CommentRecord = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;
type CommentView = Omit<CommentRecord, 'deletedAt'>;

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLogService: OperationLogService,
  ) {}

  async listForbiddenWords(query: PaginationQuery) {
    const pagination = parsePagination(query);
    const where: Prisma.ForbiddenWordWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { word: { contains: pagination.search } },
        { note: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.forbiddenWord.findMany({
        where,
        select: forbiddenWordSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.forbiddenWord.count({ where }),
    ]);

    return withPagination(items, pagination.page, pagination.pageSize, total);
  }

  async createForbiddenWord(dto: CreateForbiddenWordDto, adminId: number, ip?: string) {
    const word = await this.prisma.forbiddenWord.create({
      data: normalizeForbiddenWordCreate(dto),
      select: forbiddenWordSelect,
    });
    await this.writeLog(OperationType.CREATE, TargetType.MESSAGE, `forbidden-word:${word.id}`, adminId, ip, {
      word: word.word,
    });

    return word;
  }

  async updateForbiddenWord(id: number, dto: UpdateForbiddenWordDto, adminId: number, ip?: string) {
    await this.findForbiddenWord(id);
    const word = await this.prisma.forbiddenWord.update({
      where: { id },
      data: normalizeForbiddenWordUpdate(dto),
      select: forbiddenWordSelect,
    });
    await this.writeLog(OperationType.UPDATE, TargetType.MESSAGE, `forbidden-word:${word.id}`, adminId, ip, {
      word: word.word,
    });

    return word;
  }

  async deleteForbiddenWord(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const word = await this.findForbiddenWord(id);
    await this.prisma.forbiddenWord.delete({ where: { id } });
    await this.writeLog(OperationType.DELETE, TargetType.MESSAGE, `forbidden-word:${word.id}`, adminId, ip, {
      word: word.word,
    });

    return { ok: true };
  }

  async listBlacklistItems(query: PaginationQuery) {
    const pagination = parsePagination(query);
    const where: Prisma.BlacklistItemWhereInput = {};
    if (pagination.search) {
      where.OR = [
        { value: { contains: pagination.search } },
        { note: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.blacklistItem.findMany({
        where,
        select: blacklistItemSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.blacklistItem.count({ where }),
    ]);

    return withPagination(items, pagination.page, pagination.pageSize, total);
  }

  async createBlacklistItem(dto: CreateBlacklistItemDto, adminId: number, ip?: string) {
    const item = await this.prisma.blacklistItem.create({
      data: normalizeBlacklistCreate(dto),
      select: blacklistItemSelect,
    });
    await this.writeLog(OperationType.CREATE, TargetType.MESSAGE, `blacklist:${item.id}`, adminId, ip, {
      type: item.type,
      value: item.value,
    });

    return item;
  }

  async updateBlacklistItem(id: number, dto: UpdateBlacklistItemDto, adminId: number, ip?: string) {
    await this.findBlacklistItem(id);
    const item = await this.prisma.blacklistItem.update({
      where: { id },
      data: normalizeBlacklistUpdate(dto),
      select: blacklistItemSelect,
    });
    await this.writeLog(OperationType.UPDATE, TargetType.MESSAGE, `blacklist:${item.id}`, adminId, ip, {
      type: item.type,
      value: item.value,
    });

    return item;
  }

  async deleteBlacklistItem(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const item = await this.findBlacklistItem(id);
    await this.prisma.blacklistItem.delete({ where: { id } });
    await this.writeLog(OperationType.DELETE, TargetType.MESSAGE, `blacklist:${item.id}`, adminId, ip, {
      type: item.type,
      value: item.value,
    });

    return { ok: true };
  }

  async submitMessage(dto: CreateMessageDto, visitorId: string | undefined, ip?: string, userAgent?: string) {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    const payload = normalizeMessageCreate(dto);
    const audit = await this.evaluateEntry(payload, normalizedVisitorId, ip);
    const message = await this.prisma.message.create({
      data: {
        ...payload,
        auditStatus: audit.status,
        blacklistMatched: audit.blacklistMatched,
        browser: parseBrowser(userAgent),
        device: parseDevice(userAgent),
        hitWords: audit.hitWords.length ? (audit.hitWords as Prisma.InputJsonArray) : undefined,
        ipHash: ip ? hashIp(ip) : null,
        ipMasked: maskIp(ip),
        visitorId: normalizedVisitorId,
      },
      select: messageSelect,
    });
    await this.writeAuditRecord(TargetType.MESSAGE, message.id, audit.status, audit.reason, audit.hitWords);

    return toMessageView(message);
  }

  async listPublicMessages(query: PaginationQuery) {
    const pagination = parsePagination(query);
    const where: Prisma.MessageWhereInput = {
      auditStatus: AuditStatus.APPROVED,
      deletedAt: null,
    };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        select: messageSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.message.count({ where }),
    ]);

    return withPagination(items.map(toPublicMessage), pagination.page, pagination.pageSize, total);
  }

  async listAdminMessages(query: ListMessageDto) {
    const pagination = parsePagination(query);
    const status = query.status ? parseAuditStatus(query.status) : undefined;
    const where: Prisma.MessageWhereInput = { deletedAt: null };
    if (status) {
      where.auditStatus = status;
    }
    if (pagination.search) {
      where.OR = [
        { nickname: { contains: pagination.search } },
        { email: { contains: pagination.search } },
        { content: { contains: pagination.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        select: messageSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.message.count({ where }),
    ]);

    return withPagination(items.map(toMessageView), pagination.page, pagination.pageSize, total);
  }

  async auditMessage(id: number, dto: AuditMessageDto, adminId: number, ip?: string) {
    const status = parseAuditStatus(dto.status);
    if (status === AuditStatus.PENDING) {
      throw new BadRequestException('status must be APPROVED or REJECTED.');
    }

    await this.findMessage(id);
    const message = await this.prisma.message.update({
      where: { id },
      data: { auditStatus: status },
      select: messageSelect,
    });
    await this.prisma.auditRecord.create({
      data: {
        reason: optionalTrimmedString(dto.reason),
        reviewedAt: new Date(),
        reviewedBy: adminId,
        status,
        targetId: String(id),
        targetType: TargetType.MESSAGE,
      },
    });
    await this.writeLog(OperationType.AUDIT, TargetType.MESSAGE, id, adminId, ip, {
      reason: optionalTrimmedString(dto.reason),
      status,
    });

    return toMessageView(message);
  }

  async deleteMessageAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const message = await this.findMessage(id);
    const deletedAt = new Date();
    await this.prisma.message.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(message.id),
        objectType: TargetType.MESSAGE,
        snapshot: toJsonObject(message),
        summary: message.content.slice(0, 120),
        title: message.nickname,
      },
    });
    await this.writeLog(OperationType.DELETE, TargetType.MESSAGE, id, adminId, ip, {
      nickname: message.nickname,
    });

    return { ok: true };
  }

  async submitComment(dto: CreateCommentDto, visitorId: string | undefined, ip?: string, userAgent?: string) {
    const normalizedVisitorId = normalizeVisitorId(visitorId);
    const payload = normalizeCommentCreate(dto);
    await this.findPublicEssay(payload.essayId);
    await this.assertValidParent(payload.essayId, payload.parentId);
    const audit = await this.evaluateEntry(payload, normalizedVisitorId, ip);
    const comment = await this.prisma.comment.create({
      data: {
        ...payload,
        auditStatus: audit.status,
        blacklistMatched: audit.blacklistMatched,
        browser: parseBrowser(userAgent),
        device: parseDevice(userAgent),
        hitWords: audit.hitWords.length ? (audit.hitWords as Prisma.InputJsonArray) : undefined,
        ipHash: ip ? hashIp(ip) : null,
        ipMasked: maskIp(ip),
        visitorId: normalizedVisitorId,
      },
      select: commentSelect,
    });
    await this.writeAuditRecord(TargetType.COMMENT, comment.id, audit.status, audit.reason, audit.hitWords);

    return toCommentView(comment);
  }

  async listPublicComments(query: ListCommentDto) {
    const essayId = parseRequiredPositiveInteger(query.essayId, 'essayId');
    await this.findPublicEssay(essayId);
    const pagination = parsePagination(query);
    const where: Prisma.CommentWhereInput = {
      auditStatus: AuditStatus.APPROVED,
      deletedAt: null,
      essayId,
    };
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        select: commentSelect,
        orderBy: [{ parentId: 'asc' }, { createdAt: 'asc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return withPagination(items.map(toPublicComment), pagination.page, pagination.pageSize, total);
  }

  async listAdminComments(query: ListCommentDto) {
    const pagination = parsePagination(query);
    const status = query.status ? parseAuditStatus(query.status) : undefined;
    const essayId = query.essayId ? parseRequiredPositiveInteger(query.essayId, 'essayId') : undefined;
    const where: Prisma.CommentWhereInput = { deletedAt: null };
    if (status) {
      where.auditStatus = status;
    }
    if (essayId) {
      where.essayId = essayId;
    }
    if (pagination.search) {
      where.OR = [
        { nickname: { contains: pagination.search } },
        { email: { contains: pagination.search } },
        { content: { contains: pagination.search } },
        { essay: { title: { contains: pagination.search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        select: commentSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return withPagination(items.map(toCommentView), pagination.page, pagination.pageSize, total);
  }

  async updateCommentAdmin(id: number, dto: UpdateCommentDto, adminId: number, ip?: string) {
    await this.findComment(id);
    const comment = await this.prisma.comment.update({
      where: { id },
      data: normalizeCommentUpdate(dto),
      select: commentSelect,
    });
    await this.writeLog(OperationType.UPDATE, TargetType.COMMENT, id, adminId, ip, {
      essayId: comment.essayId,
    });

    return toCommentView(comment);
  }

  async auditComment(id: number, dto: AuditMessageDto, adminId: number, ip?: string) {
    const status = parseAuditStatus(dto.status);
    if (status === AuditStatus.PENDING) {
      throw new BadRequestException('status must be APPROVED or REJECTED.');
    }

    await this.findComment(id);
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { auditStatus: status },
      select: commentSelect,
    });
    await this.prisma.auditRecord.create({
      data: {
        reason: optionalTrimmedString(dto.reason),
        reviewedAt: new Date(),
        reviewedBy: adminId,
        status,
        targetId: String(id),
        targetType: TargetType.COMMENT,
      },
    });
    await this.writeLog(OperationType.AUDIT, TargetType.COMMENT, id, adminId, ip, {
      reason: optionalTrimmedString(dto.reason),
      status,
    });

    return toCommentView(comment);
  }

  async replyCommentAdmin(id: number, dto: ReplyCommentDto, admin: { id: number; displayName: string; username: string }, ip?: string) {
    const parent = await this.findComment(id);
    const content = assertTrimmedString(dto.content, 'content', 2000);
    const comment = await this.prisma.comment.create({
      data: {
        auditStatus: AuditStatus.APPROVED,
        content,
        email: `${admin.username}@admin.local`,
        essayId: parent.essayId,
        nickname: admin.displayName || admin.username,
        parentId: parent.id,
        visitorId: `admin:${admin.id}`,
      },
      select: commentSelect,
    });
    await this.writeAuditRecord(TargetType.COMMENT, comment.id, AuditStatus.APPROVED, 'admin_reply', []);
    await this.writeLog(OperationType.CREATE, TargetType.COMMENT, comment.id, admin.id, ip, {
      action: 'reply',
      parentId: parent.id,
    });

    return toCommentView(comment);
  }

  async deleteCommentAdmin(id: number, adminId: number, ip?: string): Promise<{ ok: true }> {
    const comment = await this.findComment(id);
    const deletedAt = new Date();
    await this.prisma.comment.update({
      where: { id },
      data: { deletedAt },
    });
    await this.prisma.recycleBinItem.create({
      data: {
        deletedAt,
        deletedById: adminId,
        objectId: String(comment.id),
        objectType: TargetType.COMMENT,
        snapshot: toJsonObject(comment),
        summary: comment.content.slice(0, 120),
        title: comment.nickname,
      },
    });
    await this.writeLog(OperationType.DELETE, TargetType.COMMENT, id, adminId, ip, {
      essayId: comment.essayId,
    });

    return { ok: true };
  }

  private async evaluateEntry(
    message: { nickname: string; email: string; content: string },
    visitorId: string,
    ip?: string,
  ): Promise<{ status: AuditStatus; reason?: string; hitWords: string[]; blacklistMatched: boolean }> {
    // 第一版只启用 PLAIN 直接命中；REGEX_RESERVED 作为后续正则能力的结构预留。
    const [forbiddenWords, blacklistItems] = await Promise.all([
      this.prisma.forbiddenWord.findMany({
        where: { isEnabled: true, ruleType: ForbiddenRuleType.PLAIN },
        select: { word: true },
      }),
      this.prisma.blacklistItem.findMany({
        where: { isEnabled: true },
        select: { type: true, value: true },
      }),
    ]);
    const haystack = [message.nickname, message.email, message.content].join('\n').toLowerCase();
    const hitWords = forbiddenWords
      .map((item) => item.word.trim())
      .filter((word) => word && haystack.includes(word.toLowerCase()));
    const blacklistMatched = blacklistItems.some((item) =>
      matchesBlacklist(item, { email: message.email, ip, nickname: message.nickname, visitorId }),
    );

    return {
      blacklistMatched,
      hitWords,
      reason: hitWords.length > 0 ? 'forbidden_words' : blacklistMatched ? 'blacklist' : undefined,
      status: hitWords.length > 0 || blacklistMatched ? AuditStatus.PENDING : AuditStatus.APPROVED,
    };
  }

  private async findForbiddenWord(id: number) {
    const word = await this.prisma.forbiddenWord.findUnique({ where: { id }, select: forbiddenWordSelect });
    if (!word) {
      throw new NotFoundException('Forbidden word not found.');
    }

    return word;
  }

  private async findBlacklistItem(id: number) {
    const item = await this.prisma.blacklistItem.findUnique({ where: { id }, select: blacklistItemSelect });
    if (!item) {
      throw new NotFoundException('Blacklist item not found.');
    }

    return item;
  }

  private async findMessage(id: number) {
    const message = await this.prisma.message.findFirst({ where: { deletedAt: null, id }, select: messageSelect });
    if (!message) {
      throw new NotFoundException('Message not found.');
    }

    return message;
  }

  private async findComment(id: number) {
    const comment = await this.prisma.comment.findFirst({ where: { deletedAt: null, id }, select: commentSelect });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }

    return comment;
  }

  private async findPublicEssay(id: number) {
    const essay = await this.prisma.essay.findFirst({
      where: {
        deletedAt: null,
        id,
        status: PublishStatus.PUBLISHED,
        visibility: Visibility.PUBLIC,
      },
      select: { id: true },
    });
    if (!essay) {
      throw new NotFoundException('Essay not found.');
    }

    return essay;
  }

  private async assertValidParent(essayId: number, parentId: number | null) {
    if (parentId === null) {
      return;
    }

    // 回复必须挂在同一篇随笔的已通过父评论下，避免跨文章串联评论树。
    const parent = await this.prisma.comment.findFirst({
      where: {
        auditStatus: AuditStatus.APPROVED,
        deletedAt: null,
        essayId,
        id: parentId,
      },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException('parentId is invalid.');
    }
  }

  private writeAuditRecord(
    targetType: TargetType,
    targetId: number,
    status: AuditStatus,
    reason: string | undefined,
    hitWords: string[],
  ) {
    return this.prisma.auditRecord.create({
      data: {
        hitWords: hitWords.length ? (hitWords as Prisma.InputJsonArray) : undefined,
        reason,
        status,
        targetId: String(targetId),
        targetType,
      },
    });
  }

  private writeLog(
    action: OperationType,
    objectType: TargetType,
    id: number | string,
    adminId: number,
    ip?: string,
    detail?: Prisma.InputJsonObject,
  ) {
    return this.operationLogService.write({
      action,
      adminId,
      detail,
      ip,
      objectId: String(id),
      objectType,
    });
  }
}

function normalizeMessageCreate(dto: CreateMessageDto) {
  const nickname = assertTrimmedString(dto.nickname, 'nickname', 80);
  const email = assertEmail(dto.email);
  const content = assertTrimmedString(dto.content, 'content', 2000);

  return { content, email, nickname };
}

function normalizeCommentCreate(dto: CreateCommentDto) {
  const essayId = parseRequiredPositiveInteger(dto.essayId, 'essayId');
  const parentId = dto.parentId === null || dto.parentId === undefined
    ? null
    : parseRequiredPositiveInteger(dto.parentId, 'parentId');
  const nickname = assertTrimmedString(dto.nickname, 'nickname', 80);
  const email = assertEmail(dto.email);
  const content = assertTrimmedString(dto.content, 'content', 2000);

  return { content, email, essayId, nickname, parentId };
}

function normalizeCommentUpdate(dto: UpdateCommentDto): Prisma.CommentUpdateInput {
  return {
    content: dto.content === undefined ? undefined : assertTrimmedString(dto.content, 'content', 2000),
    email: dto.email === undefined ? undefined : assertEmail(dto.email),
    nickname: dto.nickname === undefined ? undefined : assertTrimmedString(dto.nickname, 'nickname', 80),
  };
}

function normalizeForbiddenWordCreate(dto: CreateForbiddenWordDto): Prisma.ForbiddenWordCreateInput {
  return {
    isEnabled: dto.isEnabled ?? true,
    note: optionalTrimmedString(dto.note),
    ruleType: parseForbiddenRuleType(dto.ruleType ?? ForbiddenRuleType.PLAIN),
    word: assertTrimmedString(dto.word, 'word', 160),
  };
}

function normalizeForbiddenWordUpdate(dto: UpdateForbiddenWordDto): Prisma.ForbiddenWordUpdateInput {
  return {
    isEnabled: dto.isEnabled,
    note: dto.note === undefined ? undefined : optionalTrimmedString(dto.note),
    ruleType: dto.ruleType === undefined ? undefined : parseForbiddenRuleType(dto.ruleType),
    word: dto.word === undefined ? undefined : assertTrimmedString(dto.word, 'word', 160),
  };
}

function normalizeBlacklistCreate(dto: CreateBlacklistItemDto): Prisma.BlacklistItemCreateInput {
  const type = parseBlacklistType(dto.type);

  return {
    isEnabled: dto.isEnabled ?? true,
    note: optionalTrimmedString(dto.note),
    type,
    value: normalizeBlacklistValue(type, dto.value),
  };
}

function normalizeBlacklistUpdate(dto: UpdateBlacklistItemDto): Prisma.BlacklistItemUpdateInput {
  const type = dto.type === undefined ? undefined : parseBlacklistType(dto.type);

  return {
    isEnabled: dto.isEnabled,
    note: dto.note === undefined ? undefined : optionalTrimmedString(dto.note),
    type,
    value: dto.value === undefined ? undefined : normalizeBlacklistValue(type, dto.value),
  };
}

function matchesBlacklist(
  item: Pick<Prisma.BlacklistItemGetPayload<{ select: { type: true; value: true } }>, 'type' | 'value'>,
  input: { nickname: string; email: string; visitorId: string; ip?: string },
) {
  const value = item.value.trim().toLowerCase();
  if (!value) {
    return false;
  }

  switch (item.type) {
    case BlacklistType.NAME:
      return input.nickname.trim().toLowerCase() === value;
    case BlacklistType.EMAIL:
      return input.email.trim().toLowerCase() === value;
    case BlacklistType.IP:
      return input.ip?.trim().toLowerCase() === value;
    case BlacklistType.VISITOR_ID:
      return input.visitorId.trim().toLowerCase() === value;
    default:
      return false;
  }
}

function normalizeBlacklistValue(type: BlacklistType | undefined, value: string | undefined) {
  const normalized = assertTrimmedString(value, 'value', 255);

  return type === BlacklistType.EMAIL ? normalized.toLowerCase() : normalized;
}

function assertEmail(value: string | undefined) {
  const email = assertTrimmedString(value, 'email', 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('email is invalid.');
  }

  return email;
}

function assertTrimmedString(value: string | undefined, field: string, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`${field} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${field} is too long.`);
  }

  return trimmed;
}

function optionalTrimmedString(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) {
    return value;
  }

  return value.trim() || null;
}

function normalizeVisitorId(value: string | undefined) {
  const visitorId = value?.trim();
  if (!visitorId) {
    throw new BadRequestException('X-Visitor-Id header is required.');
  }
  if (visitorId.length > 128) {
    throw new BadRequestException('X-Visitor-Id header is too long.');
  }

  return visitorId;
}

function parseAuditStatus(value: AuditStatus): AuditStatus {
  if (!Object.values(AuditStatus).includes(value)) {
    throw new BadRequestException('status is invalid.');
  }

  return value;
}

function parseForbiddenRuleType(value: ForbiddenRuleType): ForbiddenRuleType {
  if (!Object.values(ForbiddenRuleType).includes(value)) {
    throw new BadRequestException('ruleType is invalid.');
  }

  return value;
}

function parseBlacklistType(value: BlacklistType): BlacklistType {
  if (!Object.values(BlacklistType).includes(value)) {
    throw new BadRequestException('type is invalid.');
  }

  return value;
}

function parseRequiredPositiveInteger(value: string | number | null | undefined, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}

function toMessageView({ deletedAt: _deletedAt, ...message }: MessageRecord): MessageView {
  void _deletedAt;

  return message;
}

function toCommentView({ deletedAt: _deletedAt, ...comment }: CommentRecord): CommentView {
  void _deletedAt;

  return comment;
}

function toJsonObject(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function toPublicMessage(message: MessageRecord) {
  const view = toMessageView(message);
  // 公开留言不暴露邮箱、访客标识和审核命中信息。
  const { email: _email, visitorId: _visitorId, hitWords: _hitWords, blacklistMatched: _blacklistMatched, ...publicMessage } = view;
  void _email;
  void _visitorId;
  void _hitWords;
  void _blacklistMatched;

  return publicMessage;
}

function toPublicComment(comment: CommentRecord) {
  const view = toCommentView(comment);
  // 评论公开接口沿用留言的脱敏策略，即使第一版前台暂不展示评论。
  const { email: _email, visitorId: _visitorId, hitWords: _hitWords, blacklistMatched: _blacklistMatched, ...publicComment } = view;
  void _email;
  void _visitorId;
  void _hitWords;
  void _blacklistMatched;

  return publicComment;
}

function withPagination<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, pagination: { page, pageSize, total } };
}

function hashIp(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function maskIp(value: string | undefined): string | null {
  const ip = value?.trim();
  if (!ip) {
    return null;
  }

  const ipv4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.0`;
  }

  const segments = ip.split(':').filter(Boolean);
  if (segments.length > 2) {
    return `${segments.slice(0, 3).join(':')}::`;
  }

  return ip;
}

function parseBrowser(userAgent: string | undefined): string | null {
  const normalized = userAgent?.toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized.includes('edg/')) {
    return 'Edge';
  }
  if (normalized.includes('chrome/')) {
    return 'Chrome';
  }
  if (normalized.includes('firefox/')) {
    return 'Firefox';
  }
  if (normalized.includes('safari/')) {
    return 'Safari';
  }

  return 'Other';
}

function parseDevice(userAgent: string | undefined): string | null {
  const normalized = userAgent?.toLowerCase() ?? '';
  if (!normalized) {
    return null;
  }
  if (normalized.includes('mobile')) {
    return 'Mobile';
  }
  if (normalized.includes('tablet')) {
    return 'Tablet';
  }

  return 'Desktop';
}
