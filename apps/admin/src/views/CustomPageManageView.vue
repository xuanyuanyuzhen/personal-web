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
            data-testid="page-search"
            placeholder="搜索标题、slug 或摘要"
            style="width: 260px"
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
        新增页面
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
        label="标题"
        min-width="160"
      />
      <el-table-column
        prop="slug"
        label="Slug"
        min-width="140"
      />
      <el-table-column
        prop="summary"
        label="摘要"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="状态"
        width="110"
      >
        <template #default="{ row }">
          <el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'">
            {{ row.status === 'PUBLISHED' ? '已发布' : '草稿' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="可见范围"
        width="110"
      >
        <template #default="{ row }">
          {{ row.visibility === 'PUBLIC' ? '公开' : '仅自己可见' }}
        </template>
      </el-table-column>
      <el-table-column
        label="置顶"
        width="90"
      >
        <template #default="{ row }">
          {{ row.isPinned ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="sortOrder"
        label="排序"
        width="90"
      />
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
      :title="editingItem ? '编辑自定义页面' : '新增自定义页面'"
      width="820px"
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
            label="标题"
            prop="title"
          >
            <el-input
              v-model="form.title"
              data-testid="page-title"
            />
          </el-form-item>
          <el-form-item
            label="Slug"
            prop="slug"
          >
            <el-input
              v-model="form.slug"
              data-testid="page-slug"
              placeholder="about-me"
            />
          </el-form-item>
        </div>
        <el-form-item label="摘要">
          <el-input
            v-model="form.summary"
            data-testid="page-summary"
            type="textarea"
            :rows="3"
            resize="vertical"
          />
        </el-form-item>
        <div class="form-grid four-columns">
          <el-form-item label="状态">
            <el-select
              v-model="form.status"
              style="width: 100%"
            >
              <el-option
                label="草稿"
                value="DRAFT"
              />
              <el-option
                label="已发布"
                value="PUBLISHED"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="可见范围">
            <el-select
              v-model="form.visibility"
              style="width: 100%"
            >
              <el-option
                label="公开"
                value="PUBLIC"
              />
              <el-option
                label="仅自己可见"
                value="PRIVATE"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number
              v-model="form.sortOrder"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="置顶">
            <el-switch
              v-model="form.isPinned"
              active-text="置顶"
              inactive-text="普通"
            />
          </el-form-item>
        </div>
        <el-form-item
          label="内容"
          prop="content"
        >
          <RichTextEditor v-model="form.content" />
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
import RichTextEditor from '../components/RichTextEditor.vue';
import { ApiError } from '../services/request';
import {
  createCustomPage,
  deleteCustomPage,
  listCustomPages,
  type CustomPageItem,
  type CustomPagePayload,
  type PublishStatus,
  type Visibility,
  updateCustomPage,
} from '../services/content';

interface CustomPageForm {
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
}

const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const errorMessage = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const items = ref<CustomPageItem[]>([]);
const editingItem = ref<CustomPageItem | null>(null);
const formRef = ref();
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});
const form = reactive<CustomPageForm>(createDefaultForm());

const rules = {
  content: [{ required: true, message: '请输入页面内容', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入 slug', trigger: 'blur' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
};

onMounted(loadData);

function createDefaultForm(): CustomPageForm {
  return {
    content: '',
    isPinned: false,
    slug: '',
    sortOrder: 0,
    status: 'DRAFT',
    summary: '',
    title: '',
    visibility: 'PUBLIC',
  };
}

async function loadData() {
  loading.value = true;

  try {
    const result = await listCustomPages({
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

function resetForm(next: CustomPageForm) {
  Object.assign(form, next);
  errorMessage.value = '';
  formRef.value?.clearValidate?.();
}

function openCreateDialog() {
  editingItem.value = null;
  resetForm(createDefaultForm());
  dialogOpen.value = true;
}

function openEditDialog(item: CustomPageItem) {
  editingItem.value = item;
  resetForm({
    content: item.content ?? '',
    isPinned: item.isPinned,
    slug: item.slug,
    sortOrder: item.sortOrder,
    status: item.status,
    summary: item.summary ?? '',
    title: item.title,
    visibility: item.visibility,
  });
  dialogOpen.value = true;
}

function normalizePayload(): CustomPagePayload {
  return {
    content: form.content,
    isPinned: form.isPinned,
    slug: form.slug.trim(),
    sortOrder: form.sortOrder,
    status: form.status,
    summary: form.summary.trim() || null,
    title: form.title.trim(),
    visibility: form.visibility,
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
      await updateCustomPage(editingItem.value.id, payload);
      ElMessage.success('页面已更新');
    } else {
      await createCustomPage(payload);
      ElMessage.success('页面已创建');
    }

    dialogOpen.value = false;
    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(item: CustomPageItem) {
  await ElMessageBox.confirm(`确认删除页面“${item.title}”？删除后会进入回收站。`, '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });

  await deleteCustomPage(item.id);
  ElMessage.success('页面已删除');
  await loadData();
}

defineExpose({
  form,
  handleSubmit,
  openCreateDialog,
});
</script>
