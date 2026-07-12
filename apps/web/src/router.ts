import { nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { setGlobalLoading } from './composables/useLoading';
import { finishRoutePageFlip, startRoutePageFlip } from './composables/usePageFlip';
import HomeView from './views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),
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

router.beforeEach((to, from) => {
  startRoutePageFlip(from, to);
  setGlobalLoading(true);
});

router.afterEach(async () => {
  setGlobalLoading(false);
  await nextTick();
  await finishRoutePageFlip();
});
