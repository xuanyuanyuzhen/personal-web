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
            data-testid="navigation-search"
            placeholder="搜索名称或标识"
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
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
        新增导航
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="items"
      border
      row-key="id"
    >
      <el-table-column
        prop="title"
        label="名称"
        min-width="140"
      />
      <el-table-column
        prop="key"
        label="标识"
        min-width="120"
      />
      <el-table-column
        label="类型"
        width="120"
      >
        <template #default="{ row }">
          {{ navigationTypeLabel(row.type) }}
        </template>
      </el-table-column>
      <el-table-column
        label="地址/页面"
        min-width="220"
      >
        <template #default="{ row }">
          <span v-if="row.type === 'PAGE'">{{ row.page?.title ?? '-' }}</span>
          <span v-else>{{ row.path || row.url || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="父级"
        min-width="120"
      >
        <template #default="{ row }">
          {{ row.parent?.title ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="sortOrder"
        label="排序"
        width="90"
      />
      <el-table-column
        label="启用"
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
      :title="editingItem ? '编辑导航' : '新增导航'"
      width="680px"
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
        <div class="form-grid two-columns">
          <el-form-item
            label="名称"
            prop="title"
          >
            <el-input
              v-model="form.title"
              data-testid="navigation-title"
            />
          </el-form-item>
          <el-form-item
            label="唯一标识"
            prop="key"
          >
            <el-input
              v-model="form.key"
              data-testid="navigation-key"
            />
          </el-form-item>
        </div>
        <div class="form-grid two-columns">
          <el-form-item
            label="类型"
            prop="type"
          >
            <el-select
              v-model="form.type"
              style="width: 100%"
            >
              <el-option
                label="站内页面"
                value="INTERNAL"
              />
              <el-option
                label="外链"
                value="EXTERNAL"
              />
              <el-option
                label="自定义页面"
                value="PAGE"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="父级导航">
            <el-select
              v-model="form.parentId"
              clearable
              placeholder="无父级"
              style="width: 100%"
            >
              <el-option
                v-for="item in parentOptions"
                :key="item.id"
                :label="item.title"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item
          v-if="form.type === 'INTERNAL'"
          label="站内路径"
          prop="path"
        >
          <el-input
            v-model="form.path"
            data-testid="navigation-path"
            placeholder="/about"
          />
        </el-form-item>
        <el-form-item
          v-if="form.type === 'EXTERNAL'"
          label="外链地址"
          prop="url"
        >
          <el-input
            v-model="form.url"
            data-testid="navigation-url"
            placeholder="https://example.com"
          />
        </el-form-item>
        <el-form-item
          v-if="form.type === 'PAGE'"
          label="自定义页面"
          prop="pageId"
        >
          <el-select
            v-model="form.pageId"
            filterable
            placeholder="选择自定义页面"
            style="width: 100%"
          >
            <el-option
              v-for="page in pageOptions"
              :key="page.id"
              :label="`${page.title} / ${page.slug}`"
              :value="page.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-grid two-columns">
          <el-form-item label="打开方式">
            <el-select
              v-model="form.target"
              clearable
              style="width: 100%"
            >
              <el-option
                label="当前窗口"
                value="_self"
              />
              <el-option
                label="新窗口"
                value="_blank"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="图标标识">
            <el-input
              v-model="form.icon"
              placeholder="可选"
            />
          </el-form-item>
        </div>
        <div class="form-grid two-columns">
          <el-form-item label="排序">
            <el-input-number
              v-model="form.sortOrder"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="启用状态">
            <el-switch
              v-model="form.isEnabled"
              active-text="启用"
              inactive-text="停用"
            />
          </el-form-item>
        </div>
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
import { computed, onMounted, reactive, ref } from 'vue';
import {
  ApiError,
} from '../services/request';
import {
  createNavigation,
  deleteNavigation,
  listCustomPages,
  listNavigations,
  type CustomPageItem,
  type NavigationItem,
  type NavigationPayload,
  type NavigationType,
  updateNavigation,
} from '../services/content';

interface NavigationForm {
  key: string;
  title: string;
  type: NavigationType;
  path: string;
  url: string;
  target: string;
  icon: string;
  parentId: number | null;
  pageId: number | null;
  sortOrder: number;
  isEnabled: boolean;
}

const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const errorMessage = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const items = ref<NavigationItem[]>([]);
const pageOptions = ref<CustomPageItem[]>([]);
const editingItem = ref<NavigationItem | null>(null);
const formRef = ref();
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});
const form = reactive<NavigationForm>(createDefaultForm());

const parentOptions = computed(() => items.value.filter((item) => item.id !== editingItem.value?.id));

const rules = {
  key: [{ required: true, message: '请输入唯一标识', trigger: 'blur' }],
  pageId: [
    {
      trigger: 'change',
      validator: (_rule: unknown, value: number | null, callback: (error?: Error) => void) => {
        if (form.type === 'PAGE' && !value) {
          callback(new Error('请选择自定义页面'));
          return;
        }

        callback();
      },
    },
  ],
  path: [
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (form.type === 'INTERNAL' && !value.trim()) {
          callback(new Error('请输入站内路径'));
          return;
        }

        callback();
      },
    },
  ],
  title: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  url: [
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (form.type === 'EXTERNAL' && !value.trim()) {
          callback(new Error('请输入外链地址'));
          return;
        }

        callback();
      },
    },
  ],
};

onMounted(async () => {
  await Promise.all([loadData(), loadPageOptions()]);
});

function createDefaultForm(): NavigationForm {
  return {
    icon: '',
    isEnabled: true,
    key: '',
    pageId: null,
    parentId: null,
    path: '',
    sortOrder: 0,
    target: '',
    title: '',
    type: 'INTERNAL',
    url: '',
  };
}

function navigationTypeLabel(type: NavigationType) {
  return {
    EXTERNAL: '外链',
    INTERNAL: '站内页面',
    PAGE: '自定义页面',
  }[type];
}

async function loadData() {
  loading.value = true;

  try {
    const result = await listNavigations({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: activeSearch.value,
    });
    items.value = result.items;
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

async function loadPageOptions() {
  const result = await listCustomPages({ page: 1, pageSize: 100 });
  pageOptions.value = result.items;
}

function handleSearch() {
  activeSearch.value = searchInput.value;
  pagination.page = 1;
  void loadData();
}

function handleResetSearch() {
  searchInput.value = '';
  activeSearch.value = '';
  pagination.page = 1;
  void loadData();
}

function handlePageSizeChange() {
  pagination.page = 1;
  void loadData();
}

function resetForm(next: NavigationForm) {
  Object.assign(form, next);
  errorMessage.value = '';
  formRef.value?.clearValidate?.();
}

function openCreateDialog() {
  editingItem.value = null;
  resetForm(createDefaultForm());
  dialogOpen.value = true;
}

function openEditDialog(item: NavigationItem) {
  editingItem.value = item;
  resetForm({
    icon: item.icon ?? '',
    isEnabled: item.isEnabled,
    key: item.key,
    pageId: item.pageId,
    parentId: item.parentId,
    path: item.path ?? '',
    sortOrder: item.sortOrder,
    target: item.target ?? '',
    title: item.title,
    type: item.type,
    url: item.url ?? '',
  });
  dialogOpen.value = true;
}

function normalizePayload(): NavigationPayload {
  return {
    icon: form.icon.trim() || null,
    isEnabled: form.isEnabled,
    key: form.key.trim(),
    pageId: form.type === 'PAGE' ? form.pageId : null,
    parentId: form.parentId,
    path: form.type === 'INTERNAL' ? form.path.trim() : null,
    sortOrder: form.sortOrder,
    target: form.target || null,
    title: form.title.trim(),
    type: form.type,
    url: form.type === 'EXTERNAL' ? form.url.trim() : null,
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
      await updateNavigation(editingItem.value.id, payload);
      ElMessage.success('导航已更新');
    } else {
      await createNavigation(payload);
      ElMessage.success('导航已创建');
    }

    dialogOpen.value = false;
    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(item: NavigationItem) {
  await ElMessageBox.confirm(`确认删除导航“${item.title}”？删除后会进入回收站。`, '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });

  await deleteNavigation(item.id);
  ElMessage.success('导航已删除');
  await loadData();
}

defineExpose({
  form,
  handleSubmit,
  openCreateDialog,
});
</script>
