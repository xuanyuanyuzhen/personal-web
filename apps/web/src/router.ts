import { createRouter, createWebHistory } from 'vue-router';
import { setGlobalLoading } from './composables/useLoading';
import HomeView from './views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),

  /**
   * 切页后的滚动位置。默认行为是「保持当前滚动条」，从长页面（碎碎念 / 随笔列表）
   * 跳到别的页时会停在半截，所以这里显式接管：
   * - 浏览器前进 / 后退（savedPosition 存在）：还原原来的位置；
   *   要等新页面渲染出高度才能滚过去，所以延到下一帧（out-in 转场约 220ms，给到 260ms）。
   * - 有 hash：交给锚点。
   * - 其余正常跳转：回到顶部。
   * - 同一路由只改 query（搜索页翻页 / 换关键词、照片墙筛相册）：不动滚动条，
   *   否则「加载更多」会把用户弹回顶部。
   */
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return new Promise((resolve) => {
        setTimeout(() => resolve(savedPosition), 260);
      });
    }

    if (to.hash) {
      return { el: to.hash, top: 88 };
    }

    if (to.name === from.name && to.path === from.path) {
      return false;
    }

    return { left: 0, top: 0 };
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/thoughts',
      name: 'thoughts',
      component: () => import('./views/ThoughtsView.vue'),
    },
    {
      path: '/essays',
      name: 'essays',
      component: () => import('./views/EssaysView.vue'),
    },
    {
      path: '/essays/:idOrSlug',
      name: 'essay-detail',
      component: () => import('./views/EssayDetailView.vue'),
    },
    {
      path: '/photos',
      name: 'photos',
      component: () => import('./views/PhotosView.vue'),
    },
    {
      path: '/messages',
      name: 'messages',
      component: () => import('./views/MessagesView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('./views/SearchResultsView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('./views/AboutView.vue'),
    },
    {
      path: '/pages/:slug',
      name: 'custom-page',
      component: () => import('./views/CustomPageView.vue'),
    },
    {
      path: '/500',
      name: 'error-500',
      component: () => import('./views/ErrorView.vue'),
      meta: {
        statusCode: 500,
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./views/ErrorView.vue'),
      meta: {
        statusCode: 404,
      },
    },
  ],
});

router.beforeEach(() => {
  setGlobalLoading(true);
});

router.afterEach(() => {
  setGlobalLoading(false);
});
