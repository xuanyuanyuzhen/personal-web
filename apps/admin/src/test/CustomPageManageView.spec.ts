import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import CustomPageManageView from '../views/CustomPageManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function pagesPayload() {
  return {
    items: [
      {
        content: '<p>旧内容</p>',
        id: 1,
        isPinned: false,
        slug: 'about',
        sortOrder: 0,
        status: 'DRAFT',
        summary: '介绍',
        title: '关于我',
        visibility: 'PUBLIC',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('CustomPageManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads page list and submits rich text content', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/pages') && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2, title: '新页面' }));
      }

      return Promise.resolve(jsonResponse(pagesPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(CustomPageManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/pages?page=1&pageSize=10', expect.any(Object));
    expect(wrapper.text()).toContain('关于我');

    const vm = wrapper.vm as unknown as {
      form: { content: string; slug: string; summary: string; title: string };
      handleSubmit: () => Promise<void>;
      openCreateDialog: () => void;
    };
    vm.openCreateDialog();
    vm.form.title = '新页面';
    vm.form.slug = 'new-page';
    vm.form.summary = '摘要';
    vm.form.content = '<p>富文本内容</p>';
    await vm.handleSubmit();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/pages' && init?.method === 'POST');
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      content: '<p>富文本内容</p>',
      slug: 'new-page',
      summary: '摘要',
      title: '新页面',
    });
  });
});
