import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import EssayManageView from '../views/EssayManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function categoriesPayload() {
  return [
    {
      description: null,
      id: 1,
      isEnabled: true,
      name: '札记',
      slug: 'notes',
      sortOrder: 0,
    },
  ];
}

function essaysPayload() {
  return {
    items: [
      {
        category: { id: 1, name: '札记', slug: 'notes' },
        categoryId: 1,
        content: '<p>旧随笔</p>',
        coverUrl: null,
        id: 1,
        isPinned: false,
        likeCount: 0,
        liked: false,
        slug: 'old-note',
        sortOrder: 0,
        status: 'DRAFT',
        summary: '旧随笔',
        tags: [{ color: null, id: 1, name: '日常', slug: 'daily' }],
        title: '旧随笔',
        visibility: 'PUBLIC',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('EssayManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads essays and categories, then submits essay and category forms', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/essays' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      if (url === '/api/admin/essay-categories' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 3 }));
      }

      if (url === '/api/tags/public?scope=ESSAY') {
        return Promise.resolve(
          jsonResponse([{ color: null, id: 1, isEnabled: true, name: '日常', scopes: ['ESSAY'], slug: 'daily' }]),
        );
      }

      if (url === '/api/admin/essay-categories') {
        return Promise.resolve(jsonResponse(categoriesPayload()));
      }

      return Promise.resolve(jsonResponse(essaysPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(EssayManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/essays?page=1&pageSize=10', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/essay-categories', expect.any(Object));
    expect(wrapper.text()).toContain('旧随笔');

    const vm = wrapper.vm as unknown as {
      categoryForm: { name: string; slug: string };
      essayForm: {
        categoryId: number | null;
        content: string;
        slug: string;
        tagNames: string[];
        title: string;
      };
      handleSubmitCategory: () => Promise<void>;
      handleSubmitEssay: () => Promise<void>;
      openCreateCategoryDialog: () => void;
      openCreateEssayDialog: () => void;
    };
    vm.openCreateEssayDialog();
    vm.essayForm.title = '新随笔';
    vm.essayForm.slug = 'new-note';
    vm.essayForm.content = '<p>新随笔</p>';
    vm.essayForm.categoryId = 1;
    vm.essayForm.tagNames = ['日常'];
    await vm.handleSubmitEssay();
    await flushPromises();

    const createEssayCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/essays' && init?.method === 'POST',
    );
    expect(createEssayCall).toBeTruthy();
    expect(JSON.parse(createEssayCall?.[1]?.body as string)).toMatchObject({
      categoryId: 1,
      content: '<p>新随笔</p>',
      slug: 'new-note',
      tagNames: ['日常'],
      title: '新随笔',
    });

    vm.openCreateCategoryDialog();
    vm.categoryForm.name = '新分类';
    vm.categoryForm.slug = 'new-category';
    await vm.handleSubmitCategory();
    await flushPromises();

    const createCategoryCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/essay-categories' && init?.method === 'POST',
    );
    expect(createCategoryCall).toBeTruthy();
    expect(JSON.parse(createCategoryCall?.[1]?.body as string)).toMatchObject({
      name: '新分类',
      slug: 'new-category',
    });
  });
});
