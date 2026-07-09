import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import AnnouncementManageView from '../views/AnnouncementManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function announcementPayload() {
  return {
    content: '<p>旧公告</p>',
    isEnabled: true,
    publishedAt: '2026-06-03T00:00:00.000Z',
    title: '旧公告',
  };
}

describe('AnnouncementManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and submits announcement', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/announcement' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...announcementPayload(), title: '新公告' }));
      }

      return Promise.resolve(jsonResponse(announcementPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(AnnouncementManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/announcement', expect.any(Object));

    const vm = wrapper.vm as unknown as {
      form: { content: string; title: string };
      handleSubmit: () => Promise<void>;
    };
    vm.form.title = '新公告';
    vm.form.content = '<p>新公告</p>';
    await vm.handleSubmit();
    await flushPromises();

    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/announcement' && init?.method === 'PUT',
    );
    expect(updateCall).toBeTruthy();
    expect(JSON.parse(updateCall?.[1]?.body as string)).toMatchObject({
      content: '<p>新公告</p>',
      title: '新公告',
    });
  });
});
