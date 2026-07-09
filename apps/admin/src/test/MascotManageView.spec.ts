import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import MascotManageView from '../views/MascotManageView.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

function mascotConfig() {
  return {
    displayScopes: ['*'],
    id: 1,
    imageUrl: '/uploads/site/mascot/placeholder.png',
    isEnabled: true,
    key: 'default',
    live2dConfig: { reserved: true },
    name: '默认看板娘',
  };
}

function mascotLines() {
  return [
    {
      content: '欢迎回来，今天也慢慢记录吧。',
      id: 1,
      isEnabled: true,
      isRandom: false,
      key: 'default-home',
      pageKey: 'home',
      sortOrder: 10,
      weight: 5,
    },
  ];
}

describe('MascotManageView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads config and lines, then submits updates', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/mascot/config' && init?.method === 'PUT') {
        return Promise.resolve(jsonResponse({ ...mascotConfig(), name: '新看板娘' }));
      }

      if (url === '/api/admin/mascot/lines' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({
            content: '随机台词',
            id: 2,
            isEnabled: true,
            isRandom: true,
            key: 'random',
            pageKey: '*',
            sortOrder: 0,
            weight: 2,
          }),
        );
      }

      if (url === '/api/admin/mascot/lines') {
        return Promise.resolve(jsonResponse(mascotLines()));
      }

      return Promise.resolve(jsonResponse(mascotConfig()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(MascotManageView, {
      global: {
        plugins: [ElementPlus],
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('基础配置');
    expect(wrapper.text()).toContain('欢迎回来');

    const vm = wrapper.vm as unknown as {
      configForm: { name: string };
      handleSaveConfig: () => Promise<void>;
      handleSaveLine: () => Promise<void>;
      lineForm: {
        content: string;
        isRandom: boolean;
        pageKey: string;
        weight: number;
      };
    };

    vm.configForm.name = '新看板娘';
    await vm.handleSaveConfig();
    await flushPromises();

    const updateConfigCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/mascot/config' && init?.method === 'PUT',
    );
    expect(updateConfigCall).toBeTruthy();
    expect(JSON.parse(updateConfigCall?.[1]?.body as string)).toMatchObject({
      name: '新看板娘',
    });

    Object.assign(vm.lineForm, {
      content: '随机台词',
      isRandom: true,
      pageKey: '*',
      weight: 2,
    });
    await vm.handleSaveLine();
    await flushPromises();

    const createLineCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/admin/mascot/lines' && init?.method === 'POST',
    );
    expect(createLineCall).toBeTruthy();
    expect(JSON.parse(createLineCall?.[1]?.body as string)).toMatchObject({
      content: '随机台词',
      isRandom: true,
      pageKey: '*',
      weight: 2,
    });
  });
});
