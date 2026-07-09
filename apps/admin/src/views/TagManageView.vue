<template>
  <section class="admin-page">
    <div class="page-toolbar">
      <el-form
        class="search-form"
        inline
        @submit.prevent="handleSearch"
      >
        <el-form-item label="关键词">
          <el-input
            v-model="searchInput"
            clearable
            placeholder="搜索名称或 Slug"
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="范围">
          <el-select
            v-model="scopeFilter"
            clearable
            placeholder="全部"
            style="width: 140px"
          >
            <el-option
              v-for="option in scopeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="enabledFilter"
            clearable
            placeholder="全部"
            style="width: 120px"
          >
            <el-option
              label="启用"
              :value="true"
            />
            <el-option
              label="停用"
              :value="false"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            @click="handleSearch"
          >
            搜索
          </el-button>
          <el-button @click="handleResetSearch">
            重置
          </el-button>
        </el-form-item>
      </el-form>
      <el-button
        type="primary"
        @click="openCreateDialog"
      >
        新增标签
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="items"
      border
      row-key="id"
    >
      <el-table-column
        label="名称"
        min-width="160"
      >
        <template #default="{ row }">
          <span
            class="tag-color-dot"
            :style="{ backgroundColor: row.color || '#d8c2cc' }"
          />
          {{ row.name }}
        </template>
      </el-table-column>
      <el-table-column
        prop="slug"
        label="Slug"
        min-width="150"
      />
      <el-table-column
        label="适用范围"
        min-width="220"
      >
        <template #default="{ row }">
          <el-tag
            v-for="scope in row.scopes"
            :key="scope"
            class="tag-chip"
            size="small"
          >
            {{ scopeLabel(scope) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="状态"
        width="90"
      >
        <template #default="{ row }">
          <el-tag :type="row.isEnabled ? 'success' : 'info'">
            {{ row.isEnabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        fixed="right"
        width="150"
      >
        <template #default="{ row }">
          <el-button
            link
            type="primary"
            @click="openEditDialog(row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="confirmDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-pagination">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50]"
        :total="pagination.total"
        @current-change="loadData"
        @size-change="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="dialogOpen"
      :title="editingItem ? '编辑标签' : '新增标签'"
      width="560px"
      :close-on-click-modal="!saving"
      :teleported="false"
    >
      <el-alert
        v-if="errorMessage"
        class="dialog-alert"
        type="error"
        :title="errorMessage"
        :closable="false"
      />
      <el-form
        ref="formRef"
        label-position="top"
        :model="form"
        :rules="rules"
      >
        <div class="form-grid">
          <el-form-item
            label="名称"
            prop="name"
          >
            <el-input v-model="form.name" />
          </el-form-item>
          <el-form-item
            label="Slug"
            prop="slug"
          >
            <el-input v-model="form.slug" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="颜色">
            <el-color-picker v-model="form.color" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="form.isEnabled" />
          </el-form-item>
        </div>
        <el-form-item
          label="适用范围"
          prop="scopes"
        >
          <el-checkbox-group v-model="form.scopes">
            <el-checkbox
              v-for="option in scopeOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            >
              {{ option.label }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          :disabled="saving"
          @click="dialogOpen = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  createTag,
  deleteTag,
  listTags,
  type ManagedTagItem,
  type TagPayload,
  type TagScope,
  updateTag,
} from '../services/content';
import { ApiError } from '../services/request';

interface TagForm {
  name: string;
  slug: string;
  color: string;
  isEnabled: boolean;
  scopes: TagScope[];
}

const scopeOptions: Array<{ label: string; value: TagScope }> = [
  { label: '碎碎念', value: 'THOUGHT' },
  { label: '随笔', value: 'ESSAY' },
  { label: '照片', value: 'PHOTO' },
];

const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const errorMessage = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const scopeFilter = ref<TagScope | ''>('');
const activeScope = ref<TagScope | ''>('');
const enabledFilter = ref<boolean | ''>('');
const activeEnabled = ref<boolean | undefined>();
const items = ref<ManagedTagItem[]>([]);
const editingItem = ref<ManagedTagItem | null>(null);
const formRef = ref();
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const form = reactive<TagForm>(createDefaultForm());

const rules = {
  name: [{ required: true, message: '请输入标签名称', trigger: 'blur' }],
  scopes: [{ required: true, message: '请选择适用范围', trigger: 'change' }],
  slug: [{ required: true, message: '请输入 Slug', trigger: 'blur' }],
};

onMounted(loadData);

function createDefaultForm(): TagForm {
  return {
    color: '#c45b80',
    isEnabled: true,
    name: '',
    scopes: ['THOUGHT'],
    slug: '',
  };
}

async function loadData() {
  loading.value = true;

  try {
    const result = await listTags({
      isEnabled: activeEnabled.value,
      page: pagination.page,
      pageSize: pagination.pageSize,
      scope: activeScope.value || undefined,
      search: activeSearch.value,
    });
    items.value = result.items;
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  activeSearch.value = searchInput.value;
  activeScope.value = scopeFilter.value;
  activeEnabled.value = enabledFilter.value === '' ? undefined : enabledFilter.value;
  pagination.page = 1;
  void loadData();
}

function handleResetSearch() {
  searchInput.value = '';
  scopeFilter.value = '';
  enabledFilter.value = '';
  activeSearch.value = '';
  activeScope.value = '';
  activeEnabled.value = undefined;
  pagination.page = 1;
  void loadData();
}

function handlePageSizeChange() {
  pagination.page = 1;
  void loadData();
}

function resetForm(next: TagForm) {
  Object.assign(form, next);
  errorMessage.value = '';
  formRef.value?.clearValidate?.();
}

function openCreateDialog() {
  editingItem.value = null;
  resetForm(createDefaultForm());
  dialogOpen.value = true;
}

function openEditDialog(item: ManagedTagItem) {
  editingItem.value = item;
  resetForm({
    color: item.color ?? '#c45b80',
    isEnabled: item.isEnabled,
    name: item.name,
    scopes: [...item.scopes],
    slug: item.slug,
  });
  dialogOpen.value = true;
}

function normalizePayload(): TagPayload {
  return {
    color: form.color || null,
    isEnabled: form.isEnabled,
    name: form.name.trim(),
    scopes: form.scopes,
    slug: form.slug.trim(),
  };
}

async function handleSubmit() {
  errorMessage.value = '';
  const valid = formRef.value ? await formRef.value.validate() : true;

  if (!valid) {
    return;
  }

  saving.value = true;

  try {
    const payload = normalizePayload();

    if (editingItem.value) {
      await updateTag(editingItem.value.id, payload);
      ElMessage.success('标签已更新');
    } else {
      await createTag(payload);
      ElMessage.success('标签已创建');
    }

    dialogOpen.value = false;
    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(item: ManagedTagItem) {
  await ElMessageBox.confirm('确认删除这个标签？删除后会停用，并写入回收站记录。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });

  await deleteTag(item.id);
  ElMessage.success('标签已删除');
  await loadData();
}

function scopeLabel(scope: TagScope) {
  return scopeOptions.find((option) => option.value === scope)?.label ?? scope;
}

defineExpose({
  form,
  loadData,
  handleSubmit,
  pagination,
  openCreateDialog,
});
</script>
