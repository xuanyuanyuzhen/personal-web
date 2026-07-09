import ElementPlus, { ElMessageBox } from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import RecycleBinView from '../views/RecycleBinView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status: 200,
    ...init,
  });
}

function recyclePayload() {
  return {
    items: [
      {
        deletedAt: '2026-06-01T00:00:00.000Z',
        deletedBy: { displayName: '管理员', id: 1, username: 'admin' },
        deletedById: 1,
        id: 1,
        objectId: '12',
        objectType: 'THOUGHT',
        purgedAt: null,
        restoredAt: null,
        status: 'ACTIVE',
        summary: '一段摘要',
        title: '春日记录',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

function logsPayload() {
  return {
    items: [
      {
        action: 'DELETE',
        admin: { displayName: '管理员', id: 1, username: 'admin' },
        adminId: 1,
        createdAt: '2026-06-01T00:00:00.000Z',
        detail: { title: '春日记录' },
        id: 1,
        ip: '127.0.0.1',
        objectId: '12',
        objectType: 'THOUGHT',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('RecycleBinView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads recycle-bin items, restores, purges, and lists operation logs', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/recycle-bin/1/restore' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }

      if (url === '/api/admin/recycle-bin/1/purge' && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse({ ok: true }));
      }

      if (typeof url === 'string' && url.startsWith('/api/admin/operation-logs?')) {
        return Promise.resolve(jsonResponse(logsPayload()));
      }

      return Promise.resolve(jsonResponse(recyclePayload()));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

    const wrapper = mount(RecycleBinView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/recycle-bin?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('春日记录');

    const vm = wrapper.vm as unknown as {
      activeTab: string;
      handlePurge: (item: unknown) => Promise<void>;
      handleRestore: (item: unknown) => Promise<void>;
      loadOperationLogs: () => Promise<void>;
    };

    await vm.handleRestore(recyclePayload().items[0]);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/recycle-bin/1/restore',
      expect.objectContaining({ method: 'POST' }),
    );

    await vm.handlePurge(recyclePayload().items[0]);
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/recycle-bin/1/purge',
      expect.objectContaining({ method: 'DELETE' }),
    );

    vm.activeTab = 'logs';
    await vm.loadOperationLogs();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/operation-logs?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('127.0.0.1');
  });
});
