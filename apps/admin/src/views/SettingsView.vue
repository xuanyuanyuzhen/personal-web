<template>
  <section class="admin-page">
    <el-alert
      v-if="errorMessage"
      class="dialog-alert"
      type="error"
      :title="errorMessage"
      :closable="false"
    />
    <el-form
      ref="formRef"
      v-loading="loading"
      label-position="top"
      :model="form"
      :rules="rules"
    >
      <div class="form-grid two-columns">
        <el-form-item
          label="网站名"
          prop="siteName"
        >
          <el-input v-model="form.siteName" />
        </el-form-item>
        <el-form-item
          label="公开昵称"
          prop="publicName"
        >
          <el-input v-model="form.publicName" />
        </el-form-item>
      </div>
      <el-form-item
        label="首页介绍"
        prop="homeIntroduction"
      >
        <el-input
          v-model="form.homeIntroduction"
          type="textarea"
          :rows="3"
          resize="vertical"
        />
      </el-form-item>
      <div class="form-grid two-columns">
        <el-form-item label="GitHub 链接">
          <el-input
            v-model="form.githubUrl"
            placeholder="https://github.com/..."
          />
        </el-form-item>
        <el-form-item label="头像地址">
          <div class="avatar-setting">
            <el-input
              v-model="form.avatarUrl"
              placeholder="/uploads/site/avatar/avatar.png"
            />
            <input
              ref="avatarInputRef"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              @change="handleAvatarSelected"
            >
            <el-button
              :loading="uploadingAvatar"
              @click="avatarInputRef?.click()"
            >
              上传头像
            </el-button>
          </div>
        </el-form-item>
      </div>
      <el-form-item label="favicon 预留地址">
        <el-input
          v-model="form.faviconUrl"
          placeholder="/favicon.ico"
        />
      </el-form-item>
      <el-form-item
        label="关于我内容"
        prop="aboutContent"
      >
        <RichTextEditor v-model="form.aboutContent" />
      </el-form-item>
      <div class="form-actions">
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmit"
        >
          保存设置
        </el-button>
      </div>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { ApiError } from '../services/request';
import { getSiteSettings, updateSiteSettings, uploadAvatar, type SiteSettingsPayload } from '../services/settings';

const loading = ref(false);
const saving = ref(false);
const uploadingAvatar = ref(false);
const errorMessage = ref('');
const formRef = ref();
const avatarInputRef = ref<HTMLInputElement | null>(null);
const form = reactive<SiteSettingsPayload>({
  aboutContent: '',
  avatarUrl: '',
  faviconUrl: '',
  githubUrl: '',
  homeIntroduction: '',
  publicName: '',
  siteName: '',
});

const rules = {
  aboutContent: [{ required: true, message: '请输入关于我内容', trigger: 'blur' }],
  homeIntroduction: [{ required: true, message: '请输入首页介绍', trigger: 'blur' }],
  publicName: [{ required: true, message: '请输入公开昵称', trigger: 'blur' }],
  siteName: [{ required: true, message: '请输入网站名', trigger: 'blur' }],
};

onMounted(loadData);

async function loadData() {
  loading.value = true;

  try {
    const settings = await getSiteSettings();
    Object.assign(form, {
      aboutContent: settings.aboutContent,
      avatarUrl: settings.avatarUrl,
      faviconUrl: settings.faviconUrl,
      githubUrl: settings.githubUrl,
      homeIntroduction: settings.homeIntroduction,
      publicName: settings.publicName,
      siteName: settings.siteName,
    });
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '加载设置失败';
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  errorMessage.value = '';
  const valid = formRef.value ? await formRef.value.validate() : true;

  if (!valid) {
    return;
  }

  saving.value = true;

  try {
    const settings = await updateSiteSettings({ ...form });
    Object.assign(form, settings);
    ElMessage.success('系统设置已保存');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存设置失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function handleAvatarSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  uploadingAvatar.value = true;
  errorMessage.value = '';

  try {
    const settings = await uploadAvatar(file);
    Object.assign(form, settings);
    ElMessage.success('头像已上传');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '上传头像失败，请稍后重试';
  } finally {
    uploadingAvatar.value = false;
    if (input) {
      input.value = '';
    }
  }
}

defineExpose({
  form,
  handleAvatarSelected,
  handleSubmit,
});
</script>
