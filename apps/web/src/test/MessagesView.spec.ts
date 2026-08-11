import { flushPromises, mount } from '@vue/test-utils';
import { setLocale } from '../composables/useI18n';
import MessagesView from '../views/MessagesView.vue';

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function message(id: number, content: string) {
  return {
    avatarUrl: null,
    content,
    createdAt: '2026-06-05T00:00:00.000Z',
    id,
    nickname: '小语',
    updatedAt: '2026-06-05T00:00:00.000Z',
  };
}

describe('MessagesView', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocale('zh');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: URL | RequestInfo, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.pathname + input.search
              : input.url;

        if (url === '/api/messages' && init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse({ ...message(2, '新留言'), auditStatus: 'APPROVED' }),
          );
        }

        return Promise.resolve(
          jsonResponse({
            items: [message(1, '第一条留言')],
            pagination: { page: 1, pageSize: 12, total: 1 },
          }),
        );
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the message form and a list skeleton visible during the first request', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const wrapper = mount(MessagesView);

    expect(wrapper.find('.message-form').exists()).toBe(true);
    expect(wrapper.get('.content-skeleton-messages').attributes('aria-label')).toBe(
      '正在读取留言…',
    );
    expect(wrapper.find('.empty-state').exists()).toBe(false);
  });

  it('loads public messages and submits a new message', async () => {
    const wrapper = mount(MessagesView);
    await flushPromises();

    expect(wrapper.text()).toContain('第一条留言');

    await wrapper.get('input[autocomplete="name"]').setValue('新访客');
    await wrapper.get('input[autocomplete="email"]').setValue('new@example.com');
    await wrapper.get('textarea').setValue('新留言');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      '/api/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(wrapper.text()).toContain('留言已公开');
  });

  it('keeps list failures separate from form feedback and exposes retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) } as Response)),
    );

    const wrapper = mount(MessagesView);
    await flushPromises();

    expect(wrapper.find('.content-retry').exists()).toBe(true);
    expect(wrapper.find('.empty-state').exists()).toBe(false);

    await wrapper.get('form').trigger('submit');
    expect(wrapper.find('.message-form-actions .thought-error').exists()).toBe(true);
    expect(wrapper.find('.content-feedback .thought-error').exists()).toBe(true);
  });
});
