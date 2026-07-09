import { createRouter, createWebHistory } from 'vue-router';
import { authState, clearCurrentUser, fetchCurrentUser } from './services/auth';
import { setUnauthorizedHandler } from './services/request';
import AdminShell from './views/AdminShell.vue';
import AnnouncementManageView from './views/AnnouncementManageView.vue';
import CommentManageView from './views/CommentManageView.vue';
import CustomPageManageView from './views/CustomPageManageView.vue';
import DashboardView from './views/DashboardView.vue';
import EssayManageView from './views/EssayManageView.vue';
import LoginView from './views/LoginView.vue';
import MascotManageView from './views/MascotManageView.vue';
import MessageAuditView from './views/MessageAuditView.vue';
import MusicManageView from './views/MusicManageView.vue';
import NavigationManageView from './views/NavigationManageView.vue';
import PhotoManageView from './views/PhotoManageView.vue';
import RecycleBinView from './views/RecycleBinView.vue';
import SettingsView from './views/SettingsView.vue';
import TagManageView from './views/TagManageView.vue';
import ThoughtManageView from './views/ThoughtManageView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      component: LoginView,
      meta: {
        public: true,
      },
      name: 'login',
      path: '/login',
    },
    {
      component: AdminShell,
      children: [
        {
          component: DashboardView,
          meta: {
            title: '仪表盘',
          },
          name: 'dashboard-home',
          path: '',
        },
        {
          component: NavigationManageView,
          meta: {
            title: '导航管理',
          },
          name: 'navigations',
          path: 'navigations',
        },
        {
          component: CustomPageManageView,
          meta: {
            title: '自定义页面',
          },
          name: 'custom-pages',
          path: 'pages',
        },
        {
          component: ThoughtManageView,
          meta: {
            title: '碎碎念',
          },
          name: 'thoughts',
          path: 'thoughts',
        },
        {
          component: EssayManageView,
          meta: {
            title: '随笔',
          },
          name: 'essays',
          path: 'essays',
        },
        {
          component: TagManageView,
          meta: {
            title: '标签管理',
          },
          name: 'tags',
          path: 'tags',
        },
        {
          component: PhotoManageView,
          meta: {
            title: '照片墙',
          },
          name: 'photos',
          path: 'photos',
        },
        {
          component: MessageAuditView,
          meta: {
            title: '留言审核',
          },
          name: 'messages',
          path: 'messages',
        },
        {
          component: CommentManageView,
          meta: {
            title: '评论管理',
          },
          name: 'comments',
          path: 'comments',
        },
        {
          component: MusicManageView,
          meta: {
            title: '音乐管理',
          },
          name: 'music',
          path: 'music',
        },
        {
          component: SettingsView,
          meta: {
            title: '系统设置',
          },
          name: 'settings',
          path: 'settings',
        },
        {
          component: AnnouncementManageView,
          meta: {
            title: '首页公告',
          },
          name: 'announcement',
          path: 'announcement',
        },
        {
          component: MascotManageView,
          meta: {
            title: '看板娘',
          },
          name: 'mascot',
          path: 'mascot',
        },
        {
          component: RecycleBinView,
          meta: {
            title: '回收站与日志',
          },
          name: 'recycle-bin',
          path: 'recycle-bin',
        },
      ],
      meta: {
        requiresAuth: true,
      },
      name: 'dashboard',
      path: '/dashboard',
    },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.public === true) {
    if (!authState.initialized) {
      try {
        await fetchCurrentUser();
      } catch {
        return true;
      }
    }

    if (authState.user) {
      return { name: 'dashboard' };
    }

    return true;
  }

  if (to.meta.requiresAuth !== true) {
    return true;
  }

  try {
    await fetchCurrentUser();
    return true;
  } catch {
    return {
      name: 'login',
      query: {
        redirect: to.fullPath,
      },
    };
  }
});

setUnauthorizedHandler(() => {
  clearCurrentUser();

  if (router.currentRoute.value.name !== 'login') {
    void router.push({
      name: 'login',
      query: {
        redirect: router.currentRoute.value.fullPath,
      },
    });
  }
});
