<template>
  <main class="login-page">
    <section
      class="login-panel"
      aria-labelledby="login-title"
    >
      <div class="login-brand">
        <div class="brand-mark">
          语
        </div>
        <div>
          <p class="login-kicker">
            语尔后台
          </p>
          <h1 id="login-title">
            管理员登录
          </h1>
        </div>
      </div>

      <el-alert
        v-if="route.query.changed"
        class="login-alert"
        type="success"
        title="密码已修改，请使用新密码重新登录。"
        :closable="false"
      />

      <el-alert
        v-if="errorMessage"
        class="login-alert"
        type="error"
        :title="errorMessage"
        :closable="false"
      />

      <el-form
        ref="formRef"
        class="login-form"
        label-position="top"
        :model="form"
        :rules="rules"
        @submit.prevent="handleSubmit"
      >
        <el-form-item
          label="账号"
          prop="username"
        >
          <el-input
            v-model="form.username"
            autocomplete="username"
            placeholder="请输入管理员账号"
          />
        </el-form-item>
        <el-form-item
          label="密码"
          prop="password"
        >
          <el-input
            v-model="form.password"
            autocomplete="current-password"
            placeholder="请输入密码"
            show-password
            type="password"
          />
        </el-form-item>
        <div class="login-options">
          <el-checkbox v-model="form.rememberMe">
            记住我
          </el-checkbox>
          <span>默认账号：admin / admin123</span>
        </div>
        <el-button
          class="login-submit"
          type="primary"
          native-type="submit"
          :loading="loading"
        >
          登录
        </el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../services/auth';
import { ApiError } from '../services/request';

const router = useRouter();
const route = useRoute();
const formRef = ref();
const loading = ref(false);
const errorMessage = ref('');

const form = reactive({
  password: '',
  rememberMe: false,
  username: 'admin',
});

const rules = {
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
};

async function handleSubmit() {
  if (loading.value) {
    return;
  }

  errorMessage.value = '';
  const valid = await formRef.value?.validate();

  if (!valid) {
    return;
  }

  loading.value = true;

  try {
    await login({
      password: form.password,
      rememberMe: form.rememberMe,
      username: form.username,
    });

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard';
    await router.push(redirect);
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>
