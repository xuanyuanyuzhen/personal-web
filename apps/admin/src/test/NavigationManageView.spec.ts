import ElementPlus, { ElMessageBox } from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import NavigationManageView from '../views/NavigationManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function listPayload() {
  return {
    items: [
      {
        icon: null,
        id: 1,
        isEnabled: true,
        key: 'home',
        page: null,
        pageId: null,
        parent: null,
        parentId: null,
        path: '/',
        sortOrder: 10,
        target: null,
        title: '首页',
        type: 'INTERNAL',
        url: null,
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

function pageOptionsPayload() {
  return {
    items: [
      {
        content: '<p>关于</p>',
        id: 10,
        isPinned: false,
        slug: 'about',
        sortOrder: 0,
        status: 'PUBLISHED',
        summary: null,
        title: '关于我',
        visibility: 'PUBLIC',
      },
    ],
    pagination: { page: 1, pageSize: 100, total: 1 },
  };
}

describe('NavigationManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads navigation list and submits create form', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/pages')) {
        return Promise.resolve(jsonResponse(pageOptionsPayload()));
      }

      if (url.startsWith('/api/admin/navigations') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2, title: '关于我' }));
      }

      return Promise.resolve(jsonResponse(listPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(NavigationManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/navigations?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('首页');

    const vm = wrapper.vm as unknown as {
      form: { key: string; path: string; title: string };
      handleSubmit: () => Promise<void>;
      openCreateDialog: () => void;
    };
    vm.openCreateDialog();
    vm.form.title = '关于我';
    vm.form.key = 'about';
    vm.form.path = '/about';
    await vm.handleSubmit();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/navigations' && init?.method === 'POST',
    );
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      key: 'about',
      path: '/about',
      title: '关于我',
      type: 'INTERNAL',
    });
  });

  it('confirms before deleting navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url === '/api/admin/navigations/1' && init?.method === 'DELETE') {
          return Promise.resolve(jsonResponse({ ok: true }));
        }

        if (url.startsWith('/api/admin/pages')) {
          return Promise.resolve(jsonResponse(pageOptionsPayload()));
        }

        return Promise.resolve(jsonResponse(listPayload()));
      }),
    );
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never);

    const wrapper = mount(NavigationManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    await wrapper.findAll('button').find((button) => button.text().includes('删除'))?.trigger('click');
    await flushPromises();

    expect(ElMessageBox.confirm).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/navigations/1',
      expect.objectContaining({
        credentials: 'include',
        method: 'DELETE',
      }),
    );
  });
});
