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
            placeholder="搜索内容或摘要"
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
        新增碎碎念
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="items"
      border
      row-key="id"
    >
      <el-table-column
        prop="summary"
        label="摘要"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column
        label="标签"
        min-width="180"
      >
        <template #default="{ row }">
          <el-tag
            v-for="tag in row.tags"
            :key="tag.id"
            class="tag-chip"
            size="small"
          >
            {{ tag.name }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="状态"
        width="100"
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
        width="80"
      >
        <template #default="{ row }">
          {{ row.isPinned ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="likeCount"
        label="点赞"
        width="80"
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
      :title="editingItem ? '编辑碎碎念' : '新增碎碎念'"
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
        <el-form-item label="摘要">
          <el-input
            v-model="form.summary"
            type="textarea"
            :rows="2"
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
        <el-form-item label="标签">
          <el-select
            v-model="form.tagNames"
            default-first-option
            filterable
            multiple
            placeholder="输入后回车创建标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.id"
              :label="tag.name"
              :value="tag.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="配图地址">
          <div class="thought-image-row">
            <el-input
              v-model="form.imageUrl"
              placeholder="/uploads/images/2026/06/image.png"
            />
            <input
              ref="imageInputRef"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              @change="handleImageSelected"
            >
            <el-button
              :loading="uploadingImage"
              @click="imageInputRef?.click()"
            >
              上传配图
            </el-button>
          </div>
        </el-form-item>
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
import {
  createThought,
  deleteThought,
  listPublicTags,
  listThoughts,
  type ManagedTagItem,
  type PublishStatus,
  type ThoughtItem,
  type ThoughtPayload,
  updateThought,
  uploadImageFile,
  type Visibility,
} from '../services/content';
import { ApiError } from '../services/request';

interface ThoughtForm {
  content: string;
  summary: string;
  imageUrl: string;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  tagNames: string[];
}

const loading = ref(false);
const saving = ref(false);
const uploadingImage = ref(false);
const dialogOpen = ref(false);
const errorMessage = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const items = ref<ThoughtItem[]>([]);
const tagOptions = ref<ManagedTagItem[]>([]);
const editingItem = ref<ThoughtItem | null>(null);
const formRef = ref();
const imageInputRef = ref<HTMLInputElement | null>(null);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
});
const form = reactive<ThoughtForm>(createDefaultForm());

const rules = {
  content: [{ required: true, message: '请输入碎碎念内容', trigger: 'blur' }],
};

onMounted(() => {
  void Promise.all([loadData(), loadTagOptions()]);
});

function createDefaultForm(): ThoughtForm {
  return {
    content: '',
    imageUrl: '',
    isPinned: false,
    sortOrder: 0,
    status: 'DRAFT',
    summary: '',
    tagNames: [],
    visibility: 'PUBLIC',
  };
}

async function loadData() {
  loading.value = true;

  try {
    const result = await listThoughts({
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

async function loadTagOptions() {
  try {
    tagOptions.value = await listPublicTags('THOUGHT');
  } catch {
    tagOptions.value = [];
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

function resetForm(next: ThoughtForm) {
  Object.assign(form, next);
  errorMessage.value = '';
  formRef.value?.clearValidate?.();
}

function openCreateDialog() {
  editingItem.value = null;
  resetForm(createDefaultForm());
  dialogOpen.value = true;
}

function openEditDialog(item: ThoughtItem) {
  editingItem.value = item;
  resetForm({
    content: item.content,
    imageUrl: item.imageUrl ?? '',
    isPinned: item.isPinned,
    sortOrder: item.sortOrder,
    status: item.status,
    summary: item.summary ?? '',
    tagNames: item.tags.map((tag) => tag.name),
    visibility: item.visibility,
  });
  dialogOpen.value = true;
}

function normalizePayload(): ThoughtPayload {
  return {
    content: form.content,
    imageUrl: form.imageUrl.trim() || null,
    isPinned: form.isPinned,
    sortOrder: form.sortOrder,
    status: form.status,
    summary: form.summary.trim() || null,
    tagNames: form.tagNames,
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
      await updateThought(editingItem.value.id, payload);
      ElMessage.success('碎碎念已更新');
    } else {
      await createThought(payload);
      ElMessage.success('碎碎念已创建');
    }

    dialogOpen.value = false;
    await loadData();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function handleImageSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  uploadingImage.value = true;
  errorMessage.value = '';
  try {
    const result = await uploadImageFile(file);
    form.imageUrl = result.url;
    ElMessage.success('配图已上传');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '上传配图失败';
  } finally {
    uploadingImage.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function confirmDelete(item: ThoughtItem) {
  await ElMessageBox.confirm('确认删除这条碎碎念？删除后会进入回收站。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });

  await deleteThought(item.id);
  ElMessage.success('碎碎念已删除');
  await loadData();
}

defineExpose({
  form,
  handleImageSelected,
  handleSubmit,
  openCreateDialog,
});
</script>

<style scoped>
.thought-image-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
}
</style>
