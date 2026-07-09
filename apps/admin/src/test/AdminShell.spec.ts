import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { nextTick } from 'vue';
import { authState } from '../services/auth';
import AdminShell from '../views/AdminShell.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        children: [{ component: { template: '<div>dashboard</div>' }, name: 'dashboard-home', path: '' }],
        component: AdminShell,
        name: 'dashboard',
        path: '/dashboard',
      },
      { component: { template: '<div>login</div>' }, name: 'login', path: '/login' },
    ],
  });
}

describe('AdminShell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authState.user = { username: 'admin' };
    authState.initialized = true;
  });

  it('validates password confirmation before submitting', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const router = makeRouter();
    router.push('/dashboard');
    await router.isReady();

    const wrapper = mount(AdminShell, {
      global: {
        plugins: [router, ElementPlus],
      },
    });

    await wrapper.findAll('button').find((button) => button.text().includes('修改密码'))?.trigger('click');
    await nextTick();

    const inputs = wrapper.findAll('input[type="password"]');
    await inputs[0].setValue('admin123');
    await inputs[1].setValue('newpass1');
    await inputs[2].setValue('newpass2');
    await wrapper.findAll('button').find((button) => button.text().includes('保存并重新登录'))?.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('两次输入的新密码不一致');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
