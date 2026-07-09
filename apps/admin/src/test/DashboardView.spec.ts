import ElementPlus from 'element-plus';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';

const echartsMock = vi.hoisted(() => {
  const chart = {
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn(),
  };

  return {
    chart,
    init: vi.fn(() => chart),
    use: vi.fn(),
  };
});

const dashboardServiceMock = vi.hoisted(() => ({
  getDashboardStatistics: vi.fn(),
}));

vi.mock('echarts/core', () => ({
  init: echartsMock.init,
  use: echartsMock.use,
}));

vi.mock('echarts/charts', () => ({
  LineChart: {},
}));

vi.mock('echarts/components', () => ({
  GridComponent: {},
  LegendComponent: {},
  TooltipComponent: {},
}));

vi.mock('echarts/renderers', () => ({
  CanvasRenderer: {},
}));

vi.mock('../services/content', () => ({
  getDashboardStatistics: dashboardServiceMock.getDashboardStatistics,
}));

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { component: DashboardView, path: '/dashboard' },
      { component: { template: '<div />' }, path: '/dashboard/thoughts' },
      { component: { template: '<div />' }, path: '/dashboard/essays' },
      { component: { template: '<div />' }, path: '/dashboard/photos' },
      { component: { template: '<div />' }, path: '/dashboard/messages' },
      { component: { template: '<div />' }, path: '/dashboard/settings' },
    ],
  });
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dashboardServiceMock.getDashboardStatistics.mockResolvedValue({
      likes: {
        byType: [{ count: 4, targetType: 'SITE' }],
        last7Days: [
          { count: 0, date: '2026-06-01' },
          { count: 0, date: '2026-06-02' },
          { count: 1, date: '2026-06-03' },
          { count: 0, date: '2026-06-04' },
          { count: 2, date: '2026-06-05' },
          { count: 0, date: '2026-06-06' },
          { count: 1, date: '2026-06-07' },
        ],
        total: 4,
      },
      visits: {
        last7Days: [],
        last30Days: Array.from({ length: 30 }, (_, index) => ({
          count: index % 3,
          date: `2026-06-${String(index + 1).padStart(2, '0')}`,
        })),
        today: 3,
        topPages: [{ count: 8, pageId: 'home', pageType: 'SITE', path: '/' }],
        total: 18,
      },
    });
  });

  it('renders visit and like statistics with ECharts line charts', async () => {
    const router = makeRouter();
    await router.push('/dashboard');
    await router.isReady();

    const wrapper = mount(DashboardView, {
      global: {
        plugins: [router, ElementPlus],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('总访问量');
    expect(wrapper.text()).toContain('18');
    expect(wrapper.text()).toContain('今日访问量');
    expect(wrapper.text()).toContain('3');
    expect(wrapper.text()).toContain('点赞总数');
    expect(wrapper.text()).toContain('4');
    expect(wrapper.text()).toContain('最近 30 天访问趋势');
    expect(wrapper.text()).toContain('最近 7 天点赞趋势');
    expect(wrapper.text()).toContain('页面浏览排行');
    expect(wrapper.text()).toContain('常用入口');
    expect(wrapper.text()).not.toContain('最新留言');

    expect(echartsMock.init).toHaveBeenCalledTimes(2);
    expect(echartsMock.chart.setOption).toHaveBeenCalledTimes(2);
  });
});
