import { apiRequest } from './request';

export type NavigationType = 'INTERNAL' | 'EXTERNAL' | 'PAGE';
export type PublishStatus = 'DRAFT' | 'PUBLISHED';
export type TagScope = 'THOUGHT' | 'ESSAY' | 'PHOTO';
export type Visibility = 'PUBLIC' | 'PRIVATE';
export type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ForbiddenRuleType = 'PLAIN' | 'REGEX_RESERVED';
export type BlacklistType = 'NAME' | 'EMAIL' | 'IP' | 'VISITOR_ID';

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface ListResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface NavigationItem {
  id: number;
  key: string;
  title: string;
  type: NavigationType;
  path: string | null;
  url: string | null;
  target: string | null;
  icon: string | null;
  parentId: number | null;
  pageId: number | null;
  sortOrder: number;
  isEnabled: boolean;
  parent?: Pick<NavigationItem, 'id' | 'key' | 'title'> | null;
  page?: Pick<CustomPageItem, 'id' | 'slug' | 'title' | 'status' | 'visibility'> | null;
}

export interface NavigationPayload {
  key: string;
  title: string;
  type: NavigationType;
  path: string | null;
  url: string | null;
  target: string | null;
  icon: string | null;
  parentId: number | null;
  pageId: number | null;
  sortOrder: number;
  isEnabled: boolean;
}

export interface CustomPageItem {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomPagePayload {
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
}

export interface TagItem {
  id: number;
  name: string;
  slug: string;
  color: string | null;
}

export interface ManagedTagItem extends TagItem {
  isEnabled: boolean;
  scopes: TagScope[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TagPayload {
  name: string;
  slug: string;
  color: string | null;
  isEnabled: boolean;
  scopes: TagScope[];
}

export interface ThoughtItem {
  id: number;
  content: string;
  summary: string | null;
  imageUrl: string | null;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  likeCount: number;
  liked: boolean;
  tags: TagItem[];
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThoughtPayload {
  content: string;
  summary: string | null;
  imageUrl: string | null;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  tagNames: string[];
}

export interface EssayCategoryItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EssayCategoryPayload {
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isEnabled: boolean;
}

export interface EssayItem {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  coverUrl: string | null;
  categoryId: number | null;
  category: Pick<EssayCategoryItem, 'id' | 'name' | 'slug'> | null;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  likeCount: number;
  liked: boolean;
  tags: TagItem[];
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface EssayPayload {
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  coverUrl: string | null;
  categoryId: number | null;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  tagNames: string[];
}

export interface AlbumItem {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  status: PublishStatus;
  visibility: Visibility;
  sortOrder: number;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlbumPayload {
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  status: PublishStatus;
  visibility: Visibility;
  sortOrder: number;
  isEnabled: boolean;
}

export interface PhotoItem {
  id: number;
  title: string;
  description: string | null;
  originalUrl: string;
  largeUrl: string | null;
  thumbUrl: string | null;
  albumId: number | null;
  album: Pick<AlbumItem, 'id' | 'name' | 'slug'> | null;
  status: PublishStatus;
  visibility: Visibility;
  sortOrder: number;
  likeCount: number;
  liked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PhotoPayload {
  title: string;
  description: string | null;
  originalUrl: string;
  largeUrl: string | null;
  thumbUrl: string | null;
  albumId: number | null;
  status: PublishStatus;
  visibility: Visibility;
  sortOrder: number;
}

export interface PhotoSortPayload {
  items: Array<{ id: number; sortOrder: number }>;
}

export interface ManagedMessageItem {
  id: number;
  nickname: string;
  email: string;
  content: string;
  avatarUrl: string | null;
  visitorId: string;
  auditStatus: AuditStatus;
  hitWords: string[] | null;
  blacklistMatched: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessageListQuery extends ListQuery {
  status?: AuditStatus;
}

export interface ManagedCommentItem {
  id: number;
  essayId: number;
  parentId: number | null;
  nickname: string;
  email: string;
  content: string;
  visitorId: string;
  auditStatus: AuditStatus;
  hitWords: string[] | null;
  blacklistMatched: boolean;
  essay: Pick<EssayItem, 'id' | 'slug' | 'title'>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommentListQuery extends ListQuery {
  status?: AuditStatus;
  essayId?: number;
}

export interface CommentPayload {
  nickname?: string;
  email?: string;
  content?: string;
}

export interface ForbiddenWordItem {
  id: number;
  word: string;
  ruleType: ForbiddenRuleType;
  note: string | null;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ForbiddenWordPayload {
  word: string;
  ruleType: ForbiddenRuleType;
  note: string | null;
  isEnabled: boolean;
}

export interface BlacklistItem {
  id: number;
  type: BlacklistType;
  value: string;
  note: string | null;
  isEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlacklistPayload {
  type: BlacklistType;
  value: string;
  note: string | null;
  isEnabled: boolean;
}

export interface UploadedFileMeta {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  relativePath: string;
  storagePath: string;
  url: string;
}

export interface UploadedPhotoResult {
  kind: 'photo';
  original: UploadedFileMeta;
  large: UploadedFileMeta;
  thumb: UploadedFileMeta;
}

export type UploadedImageResult = UploadedFileMeta & {
  kind: 'image';
};

export interface TrendPoint {
  count: number;
  date: string;
}

export interface DashboardStatistics {
  likes: {
    byType: Array<{
      count: number;
      targetType: string;
    }>;
    last7Days: TrendPoint[];
    total: number;
  };
  visits: {
    last7Days: TrendPoint[];
    last30Days: TrendPoint[];
    today: number;
    topPages: Array<{
      count: number;
      pageId: string | null;
      pageType: string;
      path: string;
    }>;
    total: number;
  };
}

export interface ListQuery {
  page: number;
  pageSize: number;
  search?: string;
}

export interface TagListQuery extends ListQuery {
  scope?: TagScope;
  isEnabled?: boolean;
}

function buildQuery(query: ListQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  return params.toString();
}

function buildTagQuery(query: TagListQuery) {
  const params = new URLSearchParams(buildQuery(query));

  if (query.scope) {
    params.set('scope', query.scope);
  }

  if (query.isEnabled !== undefined) {
    params.set('isEnabled', String(query.isEnabled));
  }

  return params.toString();
}

function buildMessageQuery(query: MessageListQuery) {
  const params = new URLSearchParams(buildQuery(query));

  if (query.status) {
    params.set('status', query.status);
  }

  return params.toString();
}

function buildCommentQuery(query: CommentListQuery) {
  const params = new URLSearchParams(buildQuery(query));

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.essayId) {
    params.set('essayId', String(query.essayId));
  }

  return params.toString();
}

export function listNavigations(query: ListQuery) {
  return apiRequest<ListResult<NavigationItem>>(`/admin/navigations?${buildQuery(query)}`);
}

export function createNavigation(payload: NavigationPayload) {
  return apiRequest<NavigationItem>('/admin/navigations', {
    body: payload,
    method: 'POST',
  });
}

export function updateNavigation(id: number, payload: NavigationPayload) {
  return apiRequest<NavigationItem>(`/admin/navigations/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteNavigation(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/navigations/${id}`, {
    method: 'DELETE',
  });
}

export function listCustomPages(query: ListQuery) {
  return apiRequest<ListResult<CustomPageItem>>(`/admin/pages?${buildQuery(query)}`);
}

export function createCustomPage(payload: CustomPagePayload) {
  return apiRequest<CustomPageItem>('/admin/pages', {
    body: payload,
    method: 'POST',
  });
}

export function updateCustomPage(id: number, payload: CustomPagePayload) {
  return apiRequest<CustomPageItem>(`/admin/pages/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteCustomPage(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/pages/${id}`, {
    method: 'DELETE',
  });
}

export function listThoughts(query: ListQuery) {
  return apiRequest<ListResult<ThoughtItem>>(`/admin/thoughts?${buildQuery(query)}`);
}

export function createThought(payload: ThoughtPayload) {
  return apiRequest<ThoughtItem>('/admin/thoughts', {
    body: payload,
    method: 'POST',
  });
}

export function updateThought(id: number, payload: ThoughtPayload) {
  return apiRequest<ThoughtItem>(`/admin/thoughts/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteThought(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/thoughts/${id}`, {
    method: 'DELETE',
  });
}

export function listPublicTags(scope: TagScope) {
  return apiRequest<ManagedTagItem[]>(`/tags/public?scope=${encodeURIComponent(scope)}`);
}

export function listTags(query: TagListQuery) {
  return apiRequest<ListResult<ManagedTagItem>>(`/admin/tags?${buildTagQuery(query)}`);
}

export function createTag(payload: TagPayload) {
  return apiRequest<ManagedTagItem>('/admin/tags', {
    body: payload,
    method: 'POST',
  });
}

export function updateTag(id: number, payload: TagPayload) {
  return apiRequest<ManagedTagItem>(`/admin/tags/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteTag(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/tags/${id}`, {
    method: 'DELETE',
  });
}

export function listEssayCategories() {
  return apiRequest<EssayCategoryItem[]>('/admin/essay-categories');
}

export function createEssayCategory(payload: EssayCategoryPayload) {
  return apiRequest<EssayCategoryItem>('/admin/essay-categories', {
    body: payload,
    method: 'POST',
  });
}

export function updateEssayCategory(id: number, payload: EssayCategoryPayload) {
  return apiRequest<EssayCategoryItem>(`/admin/essay-categories/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteEssayCategory(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/essay-categories/${id}`, {
    method: 'DELETE',
  });
}

export function listEssays(query: ListQuery) {
  return apiRequest<ListResult<EssayItem>>(`/admin/essays?${buildQuery(query)}`);
}

export function createEssay(payload: EssayPayload) {
  return apiRequest<EssayItem>('/admin/essays', {
    body: payload,
    method: 'POST',
  });
}

export function updateEssay(id: number, payload: EssayPayload) {
  return apiRequest<EssayItem>(`/admin/essays/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteEssay(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/essays/${id}`, {
    method: 'DELETE',
  });
}

export function listAlbums(query: ListQuery) {
  return apiRequest<ListResult<AlbumItem>>(`/admin/albums?${buildQuery(query)}`);
}

export function createAlbum(payload: AlbumPayload) {
  return apiRequest<AlbumItem>('/admin/albums', {
    body: payload,
    method: 'POST',
  });
}

export function updateAlbum(id: number, payload: AlbumPayload) {
  return apiRequest<AlbumItem>(`/admin/albums/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteAlbum(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/albums/${id}`, {
    method: 'DELETE',
  });
}

export function listPhotos(query: ListQuery) {
  return apiRequest<ListResult<PhotoItem>>(`/admin/photos?${buildQuery(query)}`);
}

export function createPhoto(payload: PhotoPayload) {
  return apiRequest<PhotoItem>('/admin/photos', {
    body: payload,
    method: 'POST',
  });
}

export function updatePhoto(id: number, payload: PhotoPayload) {
  return apiRequest<PhotoItem>(`/admin/photos/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function sortPhotos(payload: PhotoSortPayload) {
  return apiRequest<{ ok: boolean }>('/admin/photos/sort', {
    body: payload,
    method: 'PUT',
  });
}

export function deletePhoto(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/photos/${id}`, {
    method: 'DELETE',
  });
}

export function uploadPhotoFile(file: File) {
  const body = new FormData();
  body.append('file', file);

  return apiRequest<UploadedPhotoResult>('/admin/uploads/photo', {
    body,
    method: 'POST',
  });
}

export function uploadImageFile(file: File) {
  const body = new FormData();
  body.append('file', file);

  return apiRequest<UploadedImageResult>('/admin/uploads/image', {
    body,
    method: 'POST',
  });
}

export function getDashboardStatistics() {
  return apiRequest<DashboardStatistics>('/admin/statistics');
}

export function listMessages(query: MessageListQuery) {
  return apiRequest<ListResult<ManagedMessageItem>>(`/admin/messages?${buildMessageQuery(query)}`);
}

export function auditMessage(id: number, payload: { status: AuditStatus; reason?: string | null }) {
  return apiRequest<ManagedMessageItem>(`/admin/messages/${id}/audit`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteMessage(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/messages/${id}`, {
    method: 'DELETE',
  });
}

export function listComments(query: CommentListQuery) {
  return apiRequest<ListResult<ManagedCommentItem>>(`/admin/comments?${buildCommentQuery(query)}`);
}

export function updateComment(id: number, payload: CommentPayload) {
  return apiRequest<ManagedCommentItem>(`/admin/comments/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function auditComment(id: number, payload: { status: AuditStatus; reason?: string | null }) {
  return apiRequest<ManagedCommentItem>(`/admin/comments/${id}/audit`, {
    body: payload,
    method: 'PUT',
  });
}

export function replyComment(id: number, payload: { content: string }) {
  return apiRequest<ManagedCommentItem>(`/admin/comments/${id}/reply`, {
    body: payload,
    method: 'POST',
  });
}

export function deleteComment(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/comments/${id}`, {
    method: 'DELETE',
  });
}

export function listForbiddenWords(query: ListQuery) {
  return apiRequest<ListResult<ForbiddenWordItem>>(`/admin/forbidden-words?${buildQuery(query)}`);
}

export function createForbiddenWord(payload: ForbiddenWordPayload) {
  return apiRequest<ForbiddenWordItem>('/admin/forbidden-words', {
    body: payload,
    method: 'POST',
  });
}

export function updateForbiddenWord(id: number, payload: ForbiddenWordPayload) {
  return apiRequest<ForbiddenWordItem>(`/admin/forbidden-words/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteForbiddenWord(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/forbidden-words/${id}`, {
    method: 'DELETE',
  });
}

export function listBlacklist(query: ListQuery) {
  return apiRequest<ListResult<BlacklistItem>>(`/admin/blacklist?${buildQuery(query)}`);
}

export function createBlacklistItem(payload: BlacklistPayload) {
  return apiRequest<BlacklistItem>('/admin/blacklist', {
    body: payload,
    method: 'POST',
  });
}

export function updateBlacklistItem(id: number, payload: BlacklistPayload) {
  return apiRequest<BlacklistItem>(`/admin/blacklist/${id}`, {
    body: payload,
    method: 'PUT',
  });
}

export function deleteBlacklistItem(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/blacklist/${id}`, {
    method: 'DELETE',
  });
}
