import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditStatus, Prisma, PublishStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;

type SearchSectionKey = 'thoughts' | 'pages' | 'essays' | 'photos' | 'messages';

type SearchItem = {
  createdAt: Date;
  excerpt: string;
  id: number;
  title: string;
  type: SearchSectionKey;
  url: string;
};

type SearchSection = {
  items: SearchItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchPublic(
    query: { q?: string; page?: string | number; pageSize?: string | number },
    includeAdminVisible = false,
  ): Promise<{
    query: string;
    sections: Record<SearchSectionKey, SearchSection>;
  }> {
    const keyword = normalizeKeyword(query.q);
    const page = parsePositiveInteger(query.page ?? 1, 'page');
    const pageSize = parsePositiveInteger(query.pageSize ?? DEFAULT_PAGE_SIZE, 'pageSize');

    if (pageSize > MAX_PAGE_SIZE) {
      throw new BadRequestException(`pageSize must be less than or equal to ${MAX_PAGE_SIZE}.`);
    }

    const skip = (page - 1) * pageSize;
    const [thoughts, pages, essays, photos, messages] = await Promise.all([
      this.searchThoughts(keyword, page, pageSize, skip, includeAdminVisible),
      this.searchPages(keyword, page, pageSize, skip, includeAdminVisible),
      this.searchEssays(keyword, page, pageSize, skip, includeAdminVisible),
      this.searchPhotos(keyword, page, pageSize, skip, includeAdminVisible),
      this.searchMessages(keyword, page, pageSize, skip, includeAdminVisible),
    ]);

    return {
      query: keyword,
      sections: {
        essays,
        messages,
        pages,
        photos,
        thoughts,
      },
    };
  }

  private async searchThoughts(
    keyword: string,
    page: number,
    pageSize: number,
    skip: number,
    includeAdminVisible: boolean,
  ): Promise<SearchSection> {
    const where: Prisma.ThoughtWhereInput = {
      deletedAt: null,
      OR: [{ content: { contains: keyword } }, { summary: { contains: keyword } }],
      ...(includeAdminVisible ? {} : publicContentWhere()),
    };
    const [items, total] = await Promise.all([
      this.prisma.thought.findMany({
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          content: true,
          createdAt: true,
          id: true,
          summary: true,
        },
        skip,
        take: pageSize,
        where,
      }),
      this.prisma.thought.count({ where }),
    ]);

    return section(
      items.map((item) => ({
        createdAt: item.createdAt,
        excerpt: excerpt(item.summary || item.content, keyword),
        id: item.id,
        title: titleFromText(item.summary || item.content, `碎碎念 #${item.id}`),
        type: 'thoughts',
        url: '/thoughts',
      })),
      page,
      pageSize,
      total,
    );
  }

  private async searchPages(
    keyword: string,
    page: number,
    pageSize: number,
    skip: number,
    includeAdminVisible: boolean,
  ): Promise<SearchSection> {
    const where: Prisma.CustomPageWhereInput = {
      deletedAt: null,
      OR: [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
      ],
      ...(includeAdminVisible ? {} : publicContentWhere()),
    };
    const [items, total] = await Promise.all([
      this.prisma.customPage.findMany({
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          content: true,
          createdAt: true,
          id: true,
          slug: true,
          summary: true,
          title: true,
        },
        skip,
        take: pageSize,
        where,
      }),
      this.prisma.customPage.count({ where }),
    ]);

    return section(
      items.map((item) => ({
        createdAt: item.createdAt,
        excerpt: excerpt(item.summary || item.content, keyword),
        id: item.id,
        title: item.title,
        type: 'pages',
        url: `/pages/${encodeURIComponent(item.slug)}`,
      })),
      page,
      pageSize,
      total,
    );
  }

  private async searchEssays(
    keyword: string,
    page: number,
    pageSize: number,
    skip: number,
    includeAdminVisible: boolean,
  ): Promise<SearchSection> {
    const where: Prisma.EssayWhereInput = {
      deletedAt: null,
      OR: [
        { title: { contains: keyword } },
        { summary: { contains: keyword } },
        { content: { contains: keyword } },
      ],
      ...(includeAdminVisible ? {} : publicContentWhere()),
    };
    const [items, total] = await Promise.all([
      this.prisma.essay.findMany({
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          content: true,
          createdAt: true,
          id: true,
          slug: true,
          summary: true,
          title: true,
        },
        skip,
        take: pageSize,
        where,
      }),
      this.prisma.essay.count({ where }),
    ]);

    return section(
      items.map((item) => ({
        createdAt: item.createdAt,
        excerpt: excerpt(item.summary || item.content, keyword),
        id: item.id,
        title: item.title,
        type: 'essays',
        url: `/essays/${encodeURIComponent(item.slug || String(item.id))}`,
      })),
      page,
      pageSize,
      total,
    );
  }

  private async searchPhotos(
    keyword: string,
    page: number,
    pageSize: number,
    skip: number,
    includeAdminVisible: boolean,
  ): Promise<SearchSection> {
    const where: Prisma.PhotoWhereInput = {
      deletedAt: null,
      OR: [{ title: { contains: keyword } }, { description: { contains: keyword } }],
      ...(includeAdminVisible
        ? {}
        : {
            ...publicContentWhere(),
            OR: [
              { title: { contains: keyword } },
              { description: { contains: keyword } },
            ],
            AND: [{ OR: [{ albumId: null }, { album: publicAlbumWhere() }] }],
          }),
    };
    const [items, total] = await Promise.all([
      this.prisma.photo.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          createdAt: true,
          description: true,
          id: true,
          thumbUrl: true,
          title: true,
        },
        skip,
        take: pageSize,
        where,
      }),
      this.prisma.photo.count({ where }),
    ]);

    return section(
      items.map((item) => ({
        createdAt: item.createdAt,
        excerpt: excerpt(item.description || item.title, keyword),
        id: item.id,
        title: item.title,
        type: 'photos',
        url: '/photos',
      })),
      page,
      pageSize,
      total,
    );
  }

  private async searchMessages(
    keyword: string,
    page: number,
    pageSize: number,
    skip: number,
    includeAdminVisible: boolean,
  ): Promise<SearchSection> {
    const where: Prisma.MessageWhereInput = {
      content: { contains: keyword },
      deletedAt: null,
      ...(includeAdminVisible ? {} : { auditStatus: AuditStatus.APPROVED }),
    };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        orderBy: [{ createdAt: 'desc' }],
        select: {
          content: true,
          createdAt: true,
          id: true,
          nickname: true,
        },
        skip,
        take: pageSize,
        where,
      }),
      this.prisma.message.count({ where }),
    ]);

    return section(
      items.map((item) => ({
        createdAt: item.createdAt,
        excerpt: excerpt(item.content, keyword),
        id: item.id,
        title: `${item.nickname} 的留言`,
        type: 'messages',
        url: '/messages',
      })),
      page,
      pageSize,
      total,
    );
  }
}

function publicContentWhere() {
  return {
    status: PublishStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
  };
}

function publicAlbumWhere(): Prisma.AlbumWhereInput {
  return {
    deletedAt: null,
    isEnabled: true,
    status: PublishStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
  };
}

function section(items: SearchItem[], page: number, pageSize: number, total: number): SearchSection {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
    },
  };
}

function normalizeKeyword(value: string | undefined): string {
  const keyword = value?.trim();
  if (!keyword) {
    throw new BadRequestException('q is required.');
  }
  if (keyword.length > 80) {
    throw new BadRequestException('q is too long.');
  }

  return keyword;
}

function parsePositiveInteger(value: string | number, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return parsed;
}

function titleFromText(value: string, fallback: string): string {
  const normalized = stripHtml(value);

  return normalized.slice(0, 32) || fallback;
}

function excerpt(value: string, keyword: string): string {
  const normalized = stripHtml(value);
  const lowerText = normalized.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  const start = index > 24 ? index - 24 : 0;
  const sliced = normalized.slice(start, start + 96);

  return `${start > 0 ? '...' : ''}${sliced}${normalized.length > start + sliced.length ? '...' : ''}`;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
