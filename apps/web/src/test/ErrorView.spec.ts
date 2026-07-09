import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { setLocale } from '../composables/useI18n';
import ErrorView from '../views/ErrorView.vue';

function createErrorRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        component: ErrorView,
        meta: { statusCode: 500 },
        name: 'error-500',
        path: '/500',
      },
      {
        component: ErrorView,
        meta: { statusCode: 404 },
        name: 'not-found',
        path: '/:pathMatch(.*)*',
      },
    ],
  });
}

describe('ErrorView', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders unknown routes as 404 with only back and reload actions', async () => {
    const router = createErrorRouter();
    await router.push('/missing-page');
    await router.isReady();

    const wrapper = mount(ErrorView, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain('404');
    expect(wrapper.text()).toContain('Route not found');
    expect(wrapper.findAll('.error-page-actions button')).toHaveLength(2);
    expect(wrapper.find('.error-page-actions a').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Search');
    expect(wrapper.text()).not.toContain('Home');
  });

  it('renders the 500 state from the error route', async () => {
    const router = createErrorRouter();
    await router.push('/500');
    await router.isReady();

    const wrapper = mount(ErrorView, {
      global: {
        plugins: [router],
      },
    });

    expect(wrapper.text()).toContain('500');
    expect(wrapper.text()).toContain('Service unavailable');
    expect(wrapper.findAll('.error-page-actions button')).toHaveLength(2);
  });
});
