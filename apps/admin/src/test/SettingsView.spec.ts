import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import SettingsView from '../views/SettingsView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function settingsPayload() {
  return {
    aboutContent: '<p>关于我</p>',
    avatarUrl: '',
    faviconUrl: '',
    githubUrl: 'https://github.com/example',
    homeIntroduction: '首页介绍',
    publicName: '轩辕宇振',
    siteName: '语尔',
    theme: { primary: 'pink' },
  };
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and submits site settings', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/settings' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...settingsPayload(), siteName: '新语尔' }));
      }

      return Promise.resolve(jsonResponse(settingsPayload()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(SettingsView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith('/api/site/settings', expect.any(Object));

    const vm = wrapper.vm as unknown as {
      form: { siteName: string };
      handleSubmit: () => Promise<void>;
    };
    vm.form.siteName = '新语尔';
    await vm.handleSubmit();
    await flushPromises();

    const updateCall = fetchMock.mock.calls.find(([url, init]) => url === '/api/admin/settings' && init?.method === 'PUT');
    expect(updateCall).toBeTruthy();
    expect(JSON.parse(updateCall?.[1]?.body as string)).toMatchObject({
      siteName: '新语尔',
    });
  });
});
