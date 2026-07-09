import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import LoginView from '../views/LoginView.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: LoginView, name: 'login', path: '/login' },
      { component: { template: '<div>dashboard</div>' }, name: 'dashboard', path: '/dashboard' },
    ],
  });
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json',
    },
    status: 200,
    ...init,
  });
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits login form with remember me and redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, username: 'admin' }));
    vi.stubGlobal('fetch', fetchMock);
    const router = makeRouter();
    router.push('/login?redirect=/dashboard');
    await router.isReady();

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, ElementPlus],
      },
    });

    await wrapper.find('input[type="password"]').setValue('admin123');
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        body: JSON.stringify({
          password: 'admin123',
          rememberMe: true,
          username: 'admin',
        }),
        credentials: 'include',
        method: 'POST',
      }),
    );
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('shows backend error when login fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: '账号或密码错误' }, { status: 403 })));
    const router = makeRouter();
    router.push('/login');
    await router.isReady();

    const wrapper = mount(LoginView, {
      global: {
        plugins: [router, ElementPlus],
      },
    });

    await wrapper.find('input[type="password"]').setValue('bad-password');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('账号或密码错误');
  });
});
