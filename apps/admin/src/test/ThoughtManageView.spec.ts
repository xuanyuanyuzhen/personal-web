import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import ThoughtManageView from '../views/ThoughtManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function thoughtsPayload() {
  return {
    items: [
      {
        content: '<p>旧碎碎念</p>',
        id: 1,
        imageUrl: null,
        isPinned: false,
        likeCount: 0,
        liked: false,
        sortOrder: 0,
        status: 'DRAFT',
        summary: '旧碎碎念',
        tags: [{ color: null, id: 1, name: '日常', slug: 'daily' }],
        visibility: 'PUBLIC',
      },
    ],
    pagination: { page: 1, pageSize: 10, total: 1 },
  };
}

describe('ThoughtManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads thought list and submits create form', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/thoughts' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ id: 2 }));
      }

      if (url === '/api/admin/uploads/image' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            filename: 'thought.png',
            kind: 'image',
            mimeType: 'image/png',
            originalName: 'thought.png',
            relativePath: 'images/2026/06/thought.png',
            size: 20,
            storagePath: 'images/2026/06/thought.png',
            url: '/uploads/images/2026/06/thought.png',
          }),
        );
      }

      if (url === '/api/tags/public?scope=THOUGHT') {
        return Promise.resolve(
          jsonResponse([
            {
              color: null,
              id: 1,
              isEnabled: true,
              name: '鏃ュ父',
              scopes: ['THOUGHT'],
              slug: 'daily',
            },
          ]),
        );
      }

      return Promise.resolve(jsonResponse(thoughtsPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ThoughtManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/thoughts?page=1&pageSize=10',
      expect.any(Object),
    );
    expect(wrapper.text()).toContain('旧碎碎念');

    const vm = wrapper.vm as unknown as {
      form: { content: string; imageUrl: string; summary: string; tagNames: string[] };
      handleImageSelected: (event: Event) => Promise<void>;
      handleSubmit: () => Promise<void>;
      openCreateDialog: () => void;
    };
    vm.openCreateDialog();
    vm.form.summary = '新碎碎念';
    vm.form.content = '<p>新碎碎念</p>';
    vm.form.tagNames = ['日常'];
    await vm.handleImageSelected(
      fileChangeEvent(new File(['image'], 'thought.png', { type: 'image/png' })),
    );
    await flushPromises();
    expect(vm.form.imageUrl).toBe('/uploads/images/2026/06/thought.png');

    await vm.handleSubmit();
    await flushPromises();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/thoughts' && init?.method === 'POST',
    );
    expect(createCall).toBeTruthy();
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({
      content: '<p>新碎碎念</p>',
      imageUrl: '/uploads/images/2026/06/thought.png',
      summary: '新碎碎念',
      tagNames: ['日常'],
    });
  });

  it('shows the content column even when the summary is empty', async () => {
    // 用户实际遇到的情况：碎碎念不填摘要（summary 可选），而正文才是主体。
    // 表格原来只有「摘要」列，这种条目整行看起来是空的。
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/tags/public?scope=THOUGHT') {
        return Promise.resolve(jsonResponse([]));
      }

      return Promise.resolve(
        jsonResponse({
          items: [
            {
              content: '<p>今天<strong>风</strong>很大</p>',
              id: 1,
              imageUrl: null,
              isPinned: false,
              likeCount: 0,
              liked: false,
              sortOrder: 0,
              status: 'PUBLISHED',
              summary: null,
              tags: [],
              visibility: 'PUBLIC',
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ThoughtManageView, {
      global: { plugins: [ElementPlus] },
    });
    await flushPromises();

    // 富文本标签被剥掉，只剩可读的纯文本。
    expect(wrapper.text()).toContain('今天风很大');
    expect(wrapper.text()).not.toContain('<strong>');
  });
});

function fileChangeEvent(file: File) {
  const input = document.createElement('input');
  Object.defineProperty(input, 'files', {
    value: [file],
  });

  return { target: input } as unknown as Event;
}
