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
          label="公告标题"
          prop="title"
        >
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch
            v-model="form.isEnabled"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </div>
      <el-form-item
        label="公告内容"
        prop="content"
      >
        <RichTextEditor v-model="form.content" />
      </el-form-item>
      <div class="form-actions">
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmit"
        >
          保存公告
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
import { getAdminAnnouncement, updateAnnouncement, type AnnouncementPayload } from '../services/settings';

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const formRef = ref();
const form = reactive<AnnouncementPayload>({
  content: '',
  isEnabled: true,
  title: '',
});

const rules = {
  content: [{ required: true, message: '请输入公告内容', trigger: 'blur' }],
  title: [{ required: true, message: '请输入公告标题', trigger: 'blur' }],
};

onMounted(loadData);

async function loadData() {
  loading.value = true;

  try {
    const announcement = await getAdminAnnouncement();
    Object.assign(form, {
      content: announcement.content,
      isEnabled: announcement.isEnabled,
      title: announcement.title,
    });
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '加载公告失败';
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
    const announcement = await updateAnnouncement({ ...form });
    Object.assign(form, announcement);
    ElMessage.success('公告已保存');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存公告失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

defineExpose({
  form,
  handleSubmit,
});
</script>
