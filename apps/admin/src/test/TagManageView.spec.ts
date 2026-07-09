import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import TagManageView from '../views/TagManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function tagsPayload() {
  return {
    items: [
      {
        color: '#c45b80',
        id: 1,
        isEnabled: true,
        name: '日常',
        scopes: ['THOUGHT'],
        slug: 'daily',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('TagManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads tag list and submits create form', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/tags' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      return Promise.resolve(jsonResponse(tagsPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(TagManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/tags?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('日常');

    const vm = wrapper.vm as unknown as {
      form: { color: string; name: string; scopes: string[]; slug: string };
      handleSubmit: () => Promise<void>;
      openCreateDialog: () => void;
    };
    vm.openCreateDialog();
    vm.form.name = '随笔';
    vm.form.slug = 'essay';
    vm.form.color = '#9d365f';
    vm.form.scopes = ['ESSAY'];
    await vm.handleSubmit();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/tags' && init?.method === 'POST');
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      color: '#9d365f',
      name: '随笔',
      scopes: ['ESSAY'],
      slug: 'essay',
    });
  });

  it('loads the selected table page', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(tagsPayload())));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(TagManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      loadData: () => Promise<void>;
      pagination: { page: number; pageSize: number };
    };
    vm.pagination.page = 2;
    await vm.loadData();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/tags?page=2&pageSize=10', expect.any(Object));
  });
});
