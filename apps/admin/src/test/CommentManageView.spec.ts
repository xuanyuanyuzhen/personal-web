import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import CommentManageView from '../views/CommentManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  });
}

function commentsPayload() {
  return {
    items: [
      {
        auditStatus: 'PENDING',
        blacklistMatched: false,
        content: '这是一条评论',
        email: 'reader@example.com',
        essay: { id: 1, slug: 'hello', title: '第一篇随笔' },
        essayId: 1,
        hitWords: ['测试'],
        id: 1,
        nickname: '读者',
        parentId: null,
        visitorId: 'visitor-1',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('CommentManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads comments and submits moderation actions', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/comments/1/audit' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...commentsPayload().items[0], auditStatus: 'APPROVED' }));
      }

      if (url === '/api/admin/comments/1' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...commentsPayload().items[0], content: '已编辑评论' }));
      }

      if (url === '/api/admin/comments/1/reply' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ ...commentsPayload().items[0], content: '后台回复', id: 2, parentId: 1 }));
      }

      if (typeof url === 'string' && url.startsWith('/api/admin/comments?')) {
        return Promise.resolve(jsonResponse(commentsPayload()));
      }

      return Promise.resolve(jsonResponse({ items: [], pagination: { page: 1, pageSize: 10, total: 0 } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(CommentManageView, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/comments?page=1&pageSize=10&status=PENDING', expect.any(Object));
    expect(wrapper.text()).toContain('这是一条评论');
    expect(wrapper.text()).toContain('第一篇随笔');

    const vm = wrapper.vm as unknown as {
      editForm: { content: string };
      handleAudit: (id: number, status: 'APPROVED' | 'REJECTED') => Promise<void>;
      handleSubmitEdit: () => Promise<void>;
      handleSubmitReply: () => Promise<void>;
      openEditDialog: (comment: unknown) => void;
      openReplyDialog: (comment: unknown) => void;
      replyContent: string;
    };
    const comment = commentsPayload().items[0];

    await vm.handleAudit(1, 'APPROVED');
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/comments/1/audit' && init?.method === 'PUT')?.[1]?.body as string)).toMatchObject({
      reason: '管理员通过',
      status: 'APPROVED',
    });

    vm.openEditDialog(comment);
    vm.editForm.content = '已编辑评论';
    await vm.handleSubmitEdit();
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/comments/1' && init?.method === 'PUT')?.[1]?.body as string)).toMatchObject({
      content: '已编辑评论',
    });

    vm.openReplyDialog(comment);
    vm.replyContent = '后台回复';
    await vm.handleSubmitReply();
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/comments/1/reply' && init?.method === 'POST')?.[1]?.body as string)).toEqual({
      content: '后台回复',
    });
  });
});
