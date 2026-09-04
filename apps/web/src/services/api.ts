import { readPreviewMode } from '../utils/preview';
import { getVisitorId } from '../utils/visitor';
import type { ApiNavigationItem } from '../config/navigation';

const API_PREFIX = '/api';

type RequestOptions = RequestInit & {
  visitor?: boolean;
};

export type PublicPage = {
  id: number | string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteSettings = {
  siteName: string;
  publicName: string;
  homeIntroduction: string;
  githubUrl: string;
  avatarUrl: string;
  faviconUrl: string;
  aboutContent: string;
  theme: unknown;
};

export type PublicAnnouncement = {
  title: string;
  content: string;
  isEnabled: boolean;
  publishedAt: string | null;
};

export type PublicThoughtTag = {
  id: number;
  name: string;
  slug: string;
  color: string | null;
};

export type PublicThought = {
  id: number;
  content: string;
  summary: string | null;
  imageUrl: string | null;
  isPinned: boolean;
  likeCount: number;
  liked: boolean;
  tags: PublicThoughtTag[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicEssayCategory = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isEnabled: boolean;
};

export type PublicEssay = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  coverUrl: string | null;
  categoryId: number | null;
  category: Pick<PublicEssayCategory, 'id' | 'name' | 'slug'> | null;
  isPinned: boolean;
  likeCount: number;
  liked: boolean;
  tags: PublicThoughtTag[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicAlbum = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  sortOrder: number;
  isEnabled: boolean;
};

export type PublicPhoto = {
  id: number;
  title: string;
  description: string | null;
  originalUrl: string;
  largeUrl: string | null;
  thumbUrl: string | null;
  albumId: number | null;
  album: Pick<PublicAlbum, 'id' | 'name' | 'slug'> | null;
  sortOrder: number;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PublicMessage = {
  id: number;
  nickname: string;
  content: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubmittedMessage = PublicMessage & {
  auditStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export type CreateMessagePayload = {
  nickname: string;
  email: string;
  content: string;
};

export type LikeState = {
  liked: boolean;
  likeCount: number;
};

export type SearchSectionKey = 'thoughts' | 'pages' | 'essays' | 'photos' | 'messages';

export type SearchResultItem = {
  createdAt: string;
  excerpt: string;
  id: number;
  title: string;
  type: SearchSectionKey;
  url: string;
};

export type SearchSection = {
  items: SearchResultItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type SearchResponse = {
  query: string;
  sections: Record<SearchSectionKey, SearchSection>;
};

export type PublicMascotLine = {
  id: number;
  key: string;
  pageKey: string;
  content: string;
  weight: number;
  isRandom: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

export type PublicMascotConfig = {
  id: number;
  name: string;
  imageUrl: string | null;
  modelConfig: Record<string, unknown> | null;
  pageKey: string;
  pageLine: PublicMascotLine | null;
  randomLines: PublicMascotLine[];
};

export type PublicMusicTrack = {
  id: number;
  title: string;
  artist: string;
  localUrl: string | null;
  externalUrl: string | null;
  lyricText: string | null;
  lyricFileUrl: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecordVisitPayload = {
  pageId?: string | null;
  pageType?: 'essay' | 'message' | 'page' | 'photo' | 'site' | 'thought';
  path: string;
};

export type PaginatedResult<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
};

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.visitor) {
    headers.set('X-Visitor-Id', getVisitorId());
  }

  if (readPreviewMode()) {
    headers.set('X-Admin-Preview', '1');
  }

  const response = await fetch(`${API_PREFIX}${normalizePath(path)}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const publicApi = {
  getAnnouncement: () => apiRequest<PublicAnnouncement | null>('/site/announcement'),
  getEssay: (idOrSlug: string) =>
    apiRequest<PublicEssay>(`/essays/public/${encodeURIComponent(idOrSlug)}`, {
      visitor: true,
    }),
  getEssayCategories: () => apiRequest<PublicEssayCategory[]>('/essays/categories/public'),
  getPhotoAlbums: () => apiRequest<PublicAlbum[]>('/albums/public'),
  getNavigation: () => apiRequest<ApiNavigationItem[]>('/navigations/public'),
  getPageBySlug: (slug: string) =>
    apiRequest<PublicPage>(`/pages/public/${encodeURIComponent(slug)}`),
  getMascot: (pageKey: string) =>
    apiRequest<PublicMascotConfig | null>(`/mascot/public?pageKey=${encodeURIComponent(pageKey)}`),
  getMusic: () => apiRequest<PublicMusicTrack[]>('/music/public'),
  getSiteSettings: () => apiRequest<SiteSettings>('/site/settings'),
  getThoughtTags: () => apiRequest<PublicThoughtTag[]>('/thoughts/tags/public'),
  recordVisit: (payload: RecordVisitPayload) =>
    apiRequest<{ ok: true }>('/statistics/visit', {
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
    }),
  search: (query: { page?: number; pageSize?: number; q: string }) => {
    const params = new URLSearchParams({
      q: query.q,
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 5),
    });

    return apiRequest<SearchResponse>(`/search/public?${params.toString()}`);
  },
  listThoughts: (query: { page: number; pageSize: number; tag?: string }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });

    if (query.tag) {
      params.set('tag', query.tag);
    }

    return apiRequest<PaginatedResult<PublicThought>>(`/thoughts/public?${params.toString()}`, {
      visitor: true,
    });
  },
  listEssays: (query: { page: number; pageSize: number; category?: string }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });

    if (query.category) {
      params.set('category', query.category);
    }

    return apiRequest<PaginatedResult<PublicEssay>>(`/essays/public?${params.toString()}`, {
      visitor: true,
    });
  },
  listPhotos: (query: { page: number; pageSize: number; albumId?: number }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });

    if (query.albumId) {
      params.set('albumId', String(query.albumId));
    }

    return apiRequest<PaginatedResult<PublicPhoto>>(`/photos/public?${params.toString()}`, {
      visitor: true,
    });
  },
  listMessages: (query: { page: number; pageSize: number }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
    });

    return apiRequest<PaginatedResult<PublicMessage>>(`/messages/public?${params.toString()}`, {
      visitor: true,
    });
  },
  submitMessage: (payload: CreateMessagePayload) =>
    apiRequest<SubmittedMessage>('/messages', {
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      visitor: true,
    }),
  getSiteLikeStatus: () =>
    apiRequest<LikeState>('/likes/status?targetType=site', {
      visitor: true,
    }),
  toggleSiteLike: () =>
    apiRequest<LikeState>('/likes/toggle', {
      body: JSON.stringify({
        targetType: 'site',
      }),
      headers: {
        'content-type': 'application/json',
      },
      method: 'POST',
      visitor: true,
    }),
  togglePhotoLike: (id: number) =>
    apiRequest<{ liked: boolean; likeCount: number }>(`/photos/public/${id}/like`, {
      method: 'POST',
      visitor: true,
    }),
  toggleEssayLike: (id: number) =>
    apiRequest<{ liked: boolean; likeCount: number }>(`/essays/public/${id}/like`, {
      method: 'POST',
      visitor: true,
    }),
  toggleThoughtLike: (id: number) =>
    apiRequest<{ liked: boolean; likeCount: number }>(`/thoughts/public/${id}/like`, {
      method: 'POST',
      visitor: true,
    }),
};
