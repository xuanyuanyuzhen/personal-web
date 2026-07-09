import { AuditStatus, BlacklistType, ForbiddenRuleType } from '@prisma/client';
import { OperationLogService } from '../src/operation-log/operation-log.service';
import { MessageService } from '../src/messages/message.service';
import { PrismaService } from '../src/prisma/prisma.service';

type PrismaMock = {
  auditRecord: { create: jest.Mock };
  blacklistItem: {
    count: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  comment: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  essay: {
    findFirst: jest.Mock;
  };
  forbiddenWord: {
    count: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  message: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  recycleBinItem: {
    create: jest.Mock;
  };
};

describe('MessageService', () => {
  let prisma: PrismaMock;
  let operationLogService: { write: jest.Mock };
  let service: MessageService;

  beforeEach(() => {
    prisma = {
      auditRecord: { create: jest.fn() },
      blacklistItem: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      comment: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      essay: {
        findFirst: jest.fn(),
      },
      forbiddenWord: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      message: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      recycleBinItem: {
        create: jest.fn(),
      },
    };
    operationLogService = { write: jest.fn() };
    service = new MessageService(
      prisma as unknown as PrismaService,
      operationLogService as unknown as OperationLogService,
    );
  });

  it('auto-approves clean messages and hides private fields in public list', async () => {
    prisma.forbiddenWord.findMany.mockResolvedValue([]);
    prisma.blacklistItem.findMany.mockResolvedValue([]);
    prisma.message.create.mockImplementation(({ data }) => Promise.resolve(messageRecord(data)));
    prisma.auditRecord.create.mockResolvedValue({ id: 1 });

    await expect(
      service.submitMessage(
        { content: 'hello', email: 'Me@Example.com', nickname: 'Me' },
        'visitor-1',
        '192.168.1.8',
        'Mozilla/5.0 Chrome/120',
      ),
    ).resolves.toMatchObject({
      auditStatus: AuditStatus.APPROVED,
      email: 'me@example.com',
      visitorId: 'visitor-1',
    });
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          auditStatus: AuditStatus.APPROVED,
          browser: 'Chrome',
          ipMasked: '192.168.1.0',
        }),
      }),
    );

    prisma.message.findMany.mockResolvedValue([messageRecord({ auditStatus: AuditStatus.APPROVED })]);
    prisma.message.count.mockResolvedValue(1);
    const publicResult = await service.listPublicMessages({ page: 1, pageSize: 10 });

    expect(publicResult.items[0]).not.toHaveProperty('email');
    expect(publicResult.items[0]).not.toHaveProperty('visitorId');
  });

  it('keeps forbidden-word and blacklist hits pending instead of rejecting them', async () => {
    prisma.forbiddenWord.findMany.mockResolvedValue([{ word: '广告' }]);
    prisma.blacklistItem.findMany.mockResolvedValue([]);
    prisma.message.create.mockImplementation(({ data }) => Promise.resolve(messageRecord(data)));
    prisma.auditRecord.create.mockResolvedValue({ id: 1 });

    const forbidden = await service.submitMessage(
      { content: '这里有广告', email: 'a@example.com', nickname: 'Visitor' },
      'visitor-1',
    );

    expect(forbidden).toMatchObject({
      auditStatus: AuditStatus.PENDING,
      hitWords: ['广告'],
    });

    prisma.forbiddenWord.findMany.mockResolvedValue([]);
    prisma.blacklistItem.findMany.mockResolvedValue([{ type: BlacklistType.EMAIL, value: 'a@example.com' }]);

    const blacklisted = await service.submitMessage(
      { content: 'hello', email: 'a@example.com', nickname: 'Visitor' },
      'visitor-2',
    );

    expect(blacklisted).toMatchObject({
      auditStatus: AuditStatus.PENDING,
      blacklistMatched: true,
    });
  });

  it('audits messages and writes operation logs', async () => {
    prisma.message.findFirst.mockResolvedValue(messageRecord({ id: 3 }));
    prisma.message.update.mockResolvedValue(messageRecord({ auditStatus: AuditStatus.REJECTED, id: 3 }));
    prisma.auditRecord.create.mockResolvedValue({ id: 2 });

    await expect(
      service.auditMessage(3, { reason: '不公开', status: AuditStatus.REJECTED }, 1, '127.0.0.1'),
    ).resolves.toMatchObject({ auditStatus: AuditStatus.REJECTED, id: 3 });
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AUDIT',
        detail: expect.objectContaining({ status: AuditStatus.REJECTED }),
        objectId: '3',
        objectType: 'MESSAGE',
      }),
    );
  });

  it('submits comments, keeps hierarchy, and hides private fields publicly', async () => {
    prisma.essay.findFirst.mockResolvedValue({ id: 9 });
    prisma.comment.findFirst.mockResolvedValue(commentRecord({ auditStatus: AuditStatus.APPROVED, essayId: 9, id: 4 }));
    prisma.forbiddenWord.findMany.mockResolvedValue([]);
    prisma.blacklistItem.findMany.mockResolvedValue([]);
    prisma.comment.create.mockImplementation(({ data }) => Promise.resolve(commentRecord(data)));
    prisma.auditRecord.create.mockResolvedValue({ id: 3 });

    await expect(
      service.submitComment(
        {
          content: 'comment body',
          email: 'Visitor@Example.com',
          essayId: 9,
          nickname: 'Visitor',
          parentId: 4,
        },
        'visitor-comment',
        '10.0.0.8',
        'Mozilla/5.0 Firefox/120',
      ),
    ).resolves.toMatchObject({
      auditStatus: AuditStatus.APPROVED,
      email: 'visitor@example.com',
      essayId: 9,
      parentId: 4,
      visitorId: 'visitor-comment',
    });

    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          browser: 'Firefox',
          ipMasked: '10.0.0.0',
          parentId: 4,
        }),
      }),
    );

    prisma.comment.findMany.mockResolvedValue([commentRecord({ auditStatus: AuditStatus.APPROVED })]);
    prisma.comment.count.mockResolvedValue(1);
    const publicResult = await service.listPublicComments({ essayId: '9', page: '1', pageSize: '10' });

    expect(publicResult.items[0]).not.toHaveProperty('email');
    expect(publicResult.items[0]).not.toHaveProperty('visitorId');
    expect(publicResult.items[0]).not.toHaveProperty('hitWords');
  });

  it('keeps risky comments pending and supports admin moderation actions', async () => {
    prisma.essay.findFirst.mockResolvedValue({ id: 9 });
    prisma.comment.findFirst.mockResolvedValue(commentRecord({ auditStatus: AuditStatus.PENDING, essayId: 9, id: 5 }));
    prisma.forbiddenWord.findMany.mockResolvedValue([{ word: '广告' }]);
    prisma.blacklistItem.findMany.mockResolvedValue([]);
    prisma.comment.create.mockImplementation(({ data }) => Promise.resolve(commentRecord(data)));
    prisma.comment.update.mockImplementation(({ data, where }) => Promise.resolve(commentRecord({ ...data, id: where.id })));
    prisma.auditRecord.create.mockResolvedValue({ id: 4 });

    await expect(
      service.submitComment(
        { content: '广告评论', email: 'a@example.com', essayId: 9, nickname: 'Visitor' },
        'visitor-comment',
      ),
    ).resolves.toMatchObject({
      auditStatus: AuditStatus.PENDING,
      hitWords: ['广告'],
    });

    await expect(
      service.auditComment(5, { reason: '内容正常', status: AuditStatus.APPROVED }, 1, '127.0.0.1'),
    ).resolves.toMatchObject({ auditStatus: AuditStatus.APPROVED, id: 5 });

    await expect(
      service.replyCommentAdmin(5, { content: '谢谢你的评论' }, { displayName: '站长', id: 1, username: 'admin' }),
    ).resolves.toMatchObject({
      auditStatus: AuditStatus.APPROVED,
      content: '谢谢你的评论',
      parentId: 5,
    });

    await expect(service.deleteCommentAdmin(5, 1)).resolves.toEqual({ ok: true });
    expect(prisma.recycleBinItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          objectId: '5',
          objectType: 'COMMENT',
        }),
      }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUDIT', objectId: '5', objectType: 'COMMENT' }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE', detail: expect.objectContaining({ action: 'reply' }) }),
    );
    expect(operationLogService.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', objectId: '5', objectType: 'COMMENT' }),
    );
  });

  it('manages forbidden words and blacklist items', async () => {
    const forbiddenWord = {
      createdAt: new Date(),
      id: 1,
      isEnabled: true,
      note: null,
      ruleType: ForbiddenRuleType.PLAIN,
      updatedAt: new Date(),
      word: 'spam',
    };
    const blacklistItem = {
      createdAt: new Date(),
      id: 2,
      isEnabled: true,
      note: null,
      type: BlacklistType.EMAIL,
      updatedAt: new Date(),
      value: 'blocked@example.com',
    };

    prisma.forbiddenWord.create.mockResolvedValue({
      ...forbiddenWord,
      word: 'spam',
    });
    prisma.forbiddenWord.findUnique.mockResolvedValue(forbiddenWord);
    prisma.forbiddenWord.update.mockResolvedValue({ ...forbiddenWord, word: 'ham' });
    prisma.forbiddenWord.delete.mockResolvedValue(forbiddenWord);

    prisma.blacklistItem.create.mockResolvedValue({
      ...blacklistItem,
      value: 'blocked@example.com',
    });
    prisma.blacklistItem.findUnique.mockResolvedValue(blacklistItem);
    prisma.blacklistItem.update.mockResolvedValue({ ...blacklistItem, value: 'other@example.com' });
    prisma.blacklistItem.delete.mockResolvedValue(blacklistItem);

    await expect(service.createForbiddenWord({ word: 'spam' }, 1)).resolves.toMatchObject({ word: 'spam' });
    await expect(service.updateForbiddenWord(1, { word: 'ham' }, 1)).resolves.toMatchObject({ word: 'ham' });
    await expect(service.deleteForbiddenWord(1, 1)).resolves.toEqual({ ok: true });

    await expect(
      service.createBlacklistItem({ type: BlacklistType.EMAIL, value: 'Blocked@Example.com' }, 1),
    ).resolves.toMatchObject({ value: 'blocked@example.com' });
    await expect(
      service.updateBlacklistItem(2, { type: BlacklistType.EMAIL, value: 'Other@Example.com' }, 1),
    ).resolves.toMatchObject({ value: 'other@example.com' });
    await expect(service.deleteBlacklistItem(2, 1)).resolves.toEqual({ ok: true });

    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', objectId: 'forbidden-word:1' }));
    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', objectId: 'forbidden-word:1' }));
    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', objectId: 'forbidden-word:1' }));
    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', objectId: 'blacklist:2' }));
    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', objectId: 'blacklist:2' }));
    expect(operationLogService.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', objectId: 'blacklist:2' }));
  });
});

function messageRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-06-05T00:00:00.000Z');

  return {
    auditStatus: overrides.auditStatus ?? AuditStatus.APPROVED,
    avatarUrl: null,
    blacklistMatched: overrides.blacklistMatched ?? false,
    content: overrides.content ?? 'hello',
    createdAt: now,
    deletedAt: null,
    email: overrides.email ?? 'me@example.com',
    hitWords: overrides.hitWords ?? null,
    id: overrides.id ?? 1,
    nickname: overrides.nickname ?? 'Me',
    updatedAt: now,
    visitorId: overrides.visitorId ?? 'visitor-1',
  };
}

function commentRecord(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-06-05T00:00:00.000Z');

  return {
    auditStatus: overrides.auditStatus ?? AuditStatus.APPROVED,
    blacklistMatched: overrides.blacklistMatched ?? false,
    content: overrides.content ?? 'comment',
    createdAt: now,
    deletedAt: null,
    email: overrides.email ?? 'visitor@example.com',
    essay: overrides.essay ?? { id: overrides.essayId ?? 9, slug: 'hello-world', title: 'Hello world' },
    essayId: overrides.essayId ?? 9,
    hitWords: overrides.hitWords ?? null,
    id: overrides.id ?? 1,
    nickname: overrides.nickname ?? 'Visitor',
    parentId: overrides.parentId ?? null,
    updatedAt: now,
    visitorId: overrides.visitorId ?? 'visitor-comment',
  };
}
