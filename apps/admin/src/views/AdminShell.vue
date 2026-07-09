<template>
  <el-container class="admin-shell">
    <el-aside
      width="220px"
      class="admin-aside"
    >
      <div class="admin-logo">
        <span>语</span>
        <strong>语尔后台</strong>
      </div>
      <el-menu
        class="admin-menu"
        :default-active="activeMenu"
        router
      >
        <el-menu-item index="/dashboard">
          仪表盘
        </el-menu-item>
        <el-sub-menu index="content">
          <template #title>
            内容管理
          </template>
          <el-menu-item index="/dashboard/navigations">
            导航管理
          </el-menu-item>
          <el-menu-item index="/dashboard/pages">
            自定义页面
          </el-menu-item>
          <el-menu-item index="/dashboard/thoughts">
            碎碎念
          </el-menu-item>
          <el-menu-item index="/dashboard/essays">
            随笔
          </el-menu-item>
          <el-menu-item index="/dashboard/tags">
            标签管理
          </el-menu-item>
          <el-menu-item index="/dashboard/photos">
            照片墙
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="interaction">
          <template #title>
            互动与审核
          </template>
          <el-menu-item index="/dashboard/messages">
            留言审核
          </el-menu-item>
          <el-menu-item index="/dashboard/comments">
            评论管理
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="display">
          <template #title>
            展示配置
          </template>
          <el-menu-item index="/dashboard/music">
            音乐管理
          </el-menu-item>
        </el-sub-menu>
        <el-sub-menu index="settings">
          <template #title>
            系统设置
          </template>
          <el-menu-item index="/dashboard/settings">
            基础设置
          </el-menu-item>
          <el-menu-item index="/dashboard/announcement">
            首页公告
          </el-menu-item>
          <el-menu-item index="/dashboard/mascot">
            看板娘
          </el-menu-item>
          <el-menu-item index="/dashboard/recycle-bin">
            回收站与日志
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="admin-header">
        <div>
          <p class="header-kicker">
            后台工作台
          </p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="header-actions">
          <span class="admin-user">{{ userLabel }}</span>
          <el-button
            plain
            @click="passwordDialogOpen = true"
          >
            修改密码
          </el-button>
          <el-button
            type="primary"
            :loading="loggingOut"
            @click="handleLogout"
          >
            退出
          </el-button>
        </div>
      </el-header>
      <el-main>
        <RouterView />
      </el-main>
    </el-container>
  </el-container>

  <el-dialog
    v-model="passwordDialogOpen"
    title="修改密码"
    width="420px"
    :close-on-click-modal="!savingPassword"
    :teleported="false"
  >
    <el-alert
      v-if="passwordError"
      class="dialog-alert"
      type="error"
      :title="passwordError"
      :closable="false"
    />
    <el-form
      ref="passwordFormRef"
      label-position="top"
      :model="passwordForm"
      :rules="passwordRules"
    >
      <el-form-item
        label="当前密码"
        prop="currentPassword"
      >
        <el-input
          v-model="passwordForm.currentPassword"
          show-password
          type="password"
        />
      </el-form-item>
      <el-form-item
        label="新密码"
        prop="newPassword"
      >
        <el-input
          v-model="passwordForm.newPassword"
          show-password
          type="password"
        />
      </el-form-item>
      <el-form-item
        label="确认新密码"
        prop="confirmPassword"
      >
        <el-input
          v-model="passwordForm.confirmPassword"
          show-password
          type="password"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button
        :disabled="savingPassword"
        @click="passwordDialogOpen = false"
      >
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="savingPassword"
        @click="handleChangePassword"
      >
        保存并重新登录
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { computed, reactive, ref } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { authState, changePassword, logout } from '../services/auth';
import { ApiError } from '../services/request';

const route = useRoute();
const router = useRouter();
const loggingOut = ref(false);
const passwordDialogOpen = ref(false);
const savingPassword = ref(false);
const passwordError = ref('');
const passwordFormRef = ref();

const passwordForm = reactive({
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
});

const activeMenu = computed(() => route.path);
const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : '仪表盘'));
const userLabel = computed(() => {
  const user = authState.user;
  return user?.displayName ?? user?.nickname ?? user?.username ?? '管理员';
});

const passwordRules = {
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的新密码不一致'));
          return;
        }

        callback();
      },
    },
  ],
  currentPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '新密码至少 8 位', trigger: 'blur' },
  ],
};

async function handleLogout() {
  if (loggingOut.value) {
    return;
  }

  loggingOut.value = true;

  try {
    await logout();
    await router.push('/login');
  } finally {
    loggingOut.value = false;
  }
}

async function handleChangePassword() {
  passwordError.value = '';
  const valid = await passwordFormRef.value?.validate();

  if (!valid) {
    return;
  }

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = '两次输入的新密码不一致';
    return;
  }

  savingPassword.value = true;

  try {
    await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    ElMessage.success('密码已修改，请重新登录');
    await logout();
    await router.push({ path: '/login', query: { changed: '1' } });
  } catch (error) {
    passwordError.value = error instanceof ApiError ? error.message : '修改密码失败，请稍后重试';
  } finally {
    savingPassword.value = false;
  }
}
</script>
