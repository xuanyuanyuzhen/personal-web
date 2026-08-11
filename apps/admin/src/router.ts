import { createRouter, createWebHistory } from 'vue-router';
import { authState, clearCurrentUser, fetchCurrentUser } from './services/auth';
import { setUnauthorizedHandler } from './services/request';

// 所有页面都按路由懒加载：之前 15 个视图全是静态 import，
// 登录页也要先下完整个后台（含 ECharts、wangEditor）才能显示。
const AdminShell = () => import('./views/AdminShell.vue');
const AnnouncementManageView = () => import('./views/AnnouncementManageView.vue');
const CommentManageView = () => import('./views/CommentManageView.vue');
const CustomPageManageView = () => import('./views/CustomPageManageView.vue');
const DashboardView = () => import('./views/DashboardView.vue');
const EssayManageView = () => import('./views/EssayManageView.vue');
const LoginView = () => import('./views/LoginView.vue');
const MascotManageView = () => import('./views/MascotManageView.vue');
const MessageAuditView = () => import('./views/MessageAuditView.vue');
const MusicManageView = () => import('./views/MusicManageView.vue');
const NavigationManageView = () => import('./views/NavigationManageView.vue');
const PhotoManageView = () => import('./views/PhotoManageView.vue');
const RecycleBinView = () => import('./views/RecycleBinView.vue');
const SettingsView = () => import('./views/SettingsView.vue');
const TagManageView = () => import('./views/TagManageView.vue');
const ThoughtManageView = () => import('./views/ThoughtManageView.vue');

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
