import ElementPlus, { ElMessageBox } from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import MessageAuditView from '../views/MessageAuditView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  });
}

function messagesPayload() {
  return {
    items: [
      {
        auditStatus: 'PENDING',
        avatarUrl: null,
        blacklistMatched: false,
        content: '请帮我看看这条留言',
        email: 'reader@example.com',
        hitWords: ['测试'],
        id: 1,
        nickname: '读者',
        visitorId: 'visitor-1',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

function forbiddenPayload() {
  return {
    items: [
      {
        id: 1,
        isEnabled: true,
        note: '自动审核',
        ruleType: 'PLAIN',
        word: '测试',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

function blacklistPayload() {
  return {
    items: [
      {
        id: 1,
        isEnabled: true,
        note: '人工标记',
        type: 'EMAIL',
        value: 'blocked@example.com',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('MessageAuditView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads audit data and submits message/rule actions', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/messages/1/audit' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...messagesPayload().items[0], auditStatus: 'APPROVED' }));
      }

      if (url === '/api/admin/messages/1' && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }

      if (url === '/api/admin/forbidden-words' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      if (url === '/api/admin/blacklist' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      if (typeof url === 'string' && url.startsWith('/api/admin/messages?')) {
        return Promise.resolve(jsonResponse(messagesPayload()));
      }

      if (typeof url === 'string' && url.startsWith('/api/admin/forbidden-words?')) {
        return Promise.resolve(jsonResponse(forbiddenPayload()));
      }

      if (typeof url === 'string' && url.startsWith('/api/admin/blacklist?')) {
        return Promise.resolve(jsonResponse(blacklistPayload()));
      }

      return Promise.resolve(jsonResponse({ items: [], pagination: { page: 1, pageSize: 10, total: 0 } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

    const wrapper = mount(MessageAuditView, { global: { plugins: [ElementPlus] } });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/messages?page=1&pageSize=10&status=PENDING', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/forbidden-words?page=1&pageSize=10', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/blacklist?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('请帮我看看这条留言');

    const vm = wrapper.vm as unknown as {
      blacklistForm: { type: string; value: string };
      forbiddenForm: { word: string };
      handleAudit: (id: number, status: 'APPROVED' | 'REJECTED') => Promise<void>;
      handleDeleteMessage: (id: number) => Promise<void>;
      handleSubmitBlacklist: () => Promise<void>;
      handleSubmitForbidden: () => Promise<void>;
      openBlacklistDialog: () => void;
      openForbiddenDialog: () => void;
    };

    await vm.handleAudit(1, 'APPROVED');
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/messages/1/audit' && init?.method === 'PUT')?.[1]?.body as string)).toMatchObject({
      reason: '管理员通过',
      status: 'APPROVED',
    });

    await vm.handleDeleteMessage(1);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/messages/1',
      expect.objectContaining({
        credentials: 'include',
        method: 'DELETE',
      }),
    );

    vm.openForbiddenDialog();
    vm.forbiddenForm.word = '广告词';
    await vm.handleSubmitForbidden();
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/forbidden-words' && init?.method === 'POST')?.[1]?.body as string)).toMatchObject({
      isEnabled: true,
      ruleType: 'PLAIN',
      word: '广告词',
    });

    vm.openBlacklistDialog();
    vm.blacklistForm.type = 'EMAIL';
    vm.blacklistForm.value = 'blocked@example.com';
    await vm.handleSubmitBlacklist();
    await flushPromises();
    expect(JSON.parse(fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/blacklist' && init?.method === 'POST')?.[1]?.body as string)).toMatchObject({
      isEnabled: true,
      type: 'EMAIL',
      value: 'blocked@example.com',
    });
  });
});
