<template>
  <section class="admin-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane
        label="随笔"
        name="essays"
      >
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
                placeholder="搜索标题、摘要或内容"
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
            @click="openCreateEssayDialog"
          >
            新增随笔
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
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            label="分类"
            width="130"
          >
            <template #default="{ row }">
              {{ row.category?.name ?? '未分类' }}
            </template>
          </el-table-column>
          <el-table-column
            label="标签"
            min-width="160"
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
                @click="openEditEssayDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="confirmDeleteEssay(row)"
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
            @current-change="loadEssays"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane
        label="分类"
        name="categories"
      >
        <div class="page-toolbar">
          <span />
          <el-button
            type="primary"
            @click="openCreateCategoryDialog"
          >
            新增分类
          </el-button>
        </div>
        <el-table
          v-loading="categoryLoading"
          :data="categories"
          border
          row-key="id"
        >
          <el-table-column
            prop="name"
            label="名称"
            min-width="160"
          />
          <el-table-column
            prop="slug"
            label="Slug"
            min-width="160"
          />
          <el-table-column
            prop="description"
            label="描述"
            min-width="220"
            show-overflow-tooltip
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
                @click="openEditCategoryDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="confirmDisableCategory(row)"
              >
                停用
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="essayDialogOpen"
      :title="editingEssay ? '编辑随笔' : '新增随笔'"
      width="860px"
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
        ref="essayFormRef"
        label-position="top"
        :model="essayForm"
        :rules="essayRules"
      >
        <div class="form-grid">
          <el-form-item
            label="标题"
            prop="title"
          >
            <el-input v-model="essayForm.title" />
          </el-form-item>
          <el-form-item
            label="Slug"
            prop="slug"
          >
            <el-input v-model="essayForm.slug" />
          </el-form-item>
        </div>
        <el-form-item label="摘要">
          <el-input
            v-model="essayForm.summary"
            type="textarea"
            :rows="2"
            resize="vertical"
          />
        </el-form-item>
        <div class="form-grid four-columns">
          <el-form-item label="分类">
            <el-select
              v-model="essayForm.categoryId"
              clearable
              placeholder="未分类"
              style="width: 100%"
            >
              <el-option
                v-for="category in enabledCategories"
                :key="category.id"
                :label="category.name"
                :value="category.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="essayForm.status"
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
              v-model="essayForm.visibility"
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
          <el-form-item label="置顶">
            <el-switch
              v-model="essayForm.isPinned"
              active-text="置顶"
              inactive-text="普通"
            />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="排序">
            <el-input-number
              v-model="essayForm.sortOrder"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="封面">
            <div class="essay-cover-row">
              <el-input
                v-model="essayForm.coverUrl"
                placeholder="/uploads/images/2026/08/cover.png"
              />
              <input
                ref="coverInputRef"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                @change="handleCoverSelected"
              >
              <el-button
                :loading="uploadingCover"
                @click="coverInputRef?.click()"
              >
                上传封面
              </el-button>
            </div>
          </el-form-item>
        </div>
        <el-form-item label="标签">
          <el-select
            v-model="essayForm.tagNames"
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
        <el-form-item
          label="内容"
          prop="content"
        >
          <RichTextEditor v-model="essayForm.content" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button
          :disabled="saving"
          @click="essayDialogOpen = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmitEssay"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="categoryDialogOpen"
      :title="editingCategory ? '编辑分类' : '新增分类'"
      width="560px"
      :close-on-click-modal="!categorySaving"
      :teleported="false"
    >
      <el-alert
        v-if="categoryError"
        class="dialog-alert"
        type="error"
        :title="categoryError"
        :closable="false"
      />
      <el-form
        ref="categoryFormRef"
        label-position="top"
        :model="categoryForm"
        :rules="categoryRules"
      >
        <div class="form-grid">
          <el-form-item
            label="名称"
            prop="name"
          >
            <el-input v-model="categoryForm.name" />
          </el-form-item>
          <el-form-item
            label="Slug"
            prop="slug"
          >
            <el-input v-model="categoryForm.slug" />
          </el-form-item>
        </div>
        <el-form-item label="描述">
          <el-input
            v-model="categoryForm.description"
            type="textarea"
            :rows="3"
            resize="vertical"
          />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="排序">
            <el-input-number
              v-model="categoryForm.sortOrder"
              :min="0"
              :step="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="categoryForm.isEnabled" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button
          :disabled="categorySaving"
          @click="categoryDialogOpen = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="categorySaving"
          @click="handleSubmitCategory"
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
import RichTextEditor from '../components/RichTextEditor.vue';
import {
  createEssay,
  createEssayCategory,
  deleteEssay,
  deleteEssayCategory,
  listEssayCategories,
  listEssays,
  listPublicTags,
  type EssayCategoryItem,
  type EssayCategoryPayload,
  type EssayItem,
  type EssayPayload,
  type ManagedTagItem,
  type PublishStatus,
  updateEssay,
  updateEssayCategory,
  uploadImageFile,
  type Visibility,
} from '../services/content';
import { ApiError } from '../services/request';

interface EssayForm {
  title: string;
  slug: string;
  summary: string;
  content: string;
  coverUrl: string;
  categoryId: number | null;
  status: PublishStatus;
  visibility: Visibility;
  isPinned: boolean;
  sortOrder: number;
  tagNames: string[];
}

interface CategoryForm {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  isEnabled: boolean;
}

const activeTab = ref('essays');
const loading = ref(false);
const saving = ref(false);
const categoryLoading = ref(false);
const categorySaving = ref(false);
const essayDialogOpen = ref(false);
const categoryDialogOpen = ref(false);
const errorMessage = ref('');
const uploadingCover = ref(false);
const coverInputRef = ref<HTMLInputElement | null>(null);
const categoryError = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const items = ref<EssayItem[]>([]);
const categories = ref<EssayCategoryItem[]>([]);
const tagOptions = ref<ManagedTagItem[]>([]);
const editingEssay = ref<EssayItem | null>(null);
const editingCategory = ref<EssayCategoryItem | null>(null);
const essayFormRef = ref();
const categoryFormRef = ref();
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const essayForm = reactive<EssayForm>(createDefaultEssayForm());
const categoryForm = reactive<CategoryForm>(createDefaultCategoryForm());

const enabledCategories = computed(() => categories.value.filter((category) => category.isEnabled));

const essayRules = {
  content: [{ required: true, message: '请输入随笔内容', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入 Slug', trigger: 'blur' }],
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
};
const categoryRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入分类 Slug', trigger: 'blur' }],
};

onMounted(() => {
  void Promise.all([loadEssays(), loadCategories(), loadTagOptions()]);
});

function createDefaultEssayForm(): EssayForm {
  return {
    categoryId: null,
    content: '',
    coverUrl: '',
    isPinned: false,
    slug: '',
    sortOrder: 0,
    status: 'DRAFT',
    summary: '',
    tagNames: [],
    title: '',
    visibility: 'PUBLIC',
  };
}

function createDefaultCategoryForm(): CategoryForm {
  return {
    description: '',
    isEnabled: true,
    name: '',
    slug: '',
    sortOrder: 0,
  };
}

async function loadEssays() {
  loading.value = true;

  try {
    const result = await listEssays({
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

async function loadCategories() {
  categoryLoading.value = true;

  try {
    categories.value = await listEssayCategories();
  } finally {
    categoryLoading.value = false;
  }
}

async function loadTagOptions() {
  try {
    tagOptions.value = await listPublicTags('ESSAY');
  } catch {
    tagOptions.value = [];
  }
}

function handleSearch() {
  activeSearch.value = searchInput.value;
  pagination.page = 1;
  void loadEssays();
}

function handleResetSearch() {
  searchInput.value = '';
  activeSearch.value = '';
  pagination.page = 1;
  void loadEssays();
}

function handlePageSizeChange() {
  pagination.page = 1;
  void loadEssays();
}

function resetEssayForm(next: EssayForm) {
  Object.assign(essayForm, next);
  errorMessage.value = '';
  essayFormRef.value?.clearValidate?.();
}

function resetCategoryForm(next: CategoryForm) {
  Object.assign(categoryForm, next);
  categoryError.value = '';
  categoryFormRef.value?.clearValidate?.();
}

function openCreateEssayDialog() {
  editingEssay.value = null;
  resetEssayForm(createDefaultEssayForm());
  essayDialogOpen.value = true;
}

function openEditEssayDialog(item: EssayItem) {
  editingEssay.value = item;
  resetEssayForm({
    categoryId: item.categoryId,
    content: item.content,
    coverUrl: item.coverUrl ?? '',
    isPinned: item.isPinned,
    slug: item.slug,
    sortOrder: item.sortOrder,
    status: item.status,
    summary: item.summary ?? '',
    tagNames: item.tags.map((tag) => tag.name),
    title: item.title,
    visibility: item.visibility,
  });
  essayDialogOpen.value = true;
}

function openCreateCategoryDialog() {
  editingCategory.value = null;
  resetCategoryForm(createDefaultCategoryForm());
  categoryDialogOpen.value = true;
}

function openEditCategoryDialog(item: EssayCategoryItem) {
  editingCategory.value = item;
  resetCategoryForm({
    description: item.description ?? '',
    isEnabled: item.isEnabled,
    name: item.name,
    slug: item.slug,
    sortOrder: item.sortOrder,
  });
  categoryDialogOpen.value = true;
}

function normalizeEssayPayload(): EssayPayload {
  return {
    categoryId: essayForm.categoryId,
    content: essayForm.content,
    coverUrl: essayForm.coverUrl.trim() || null,
    isPinned: essayForm.isPinned,
    slug: essayForm.slug.trim(),
    sortOrder: essayForm.sortOrder,
    status: essayForm.status,
    summary: essayForm.summary.trim() || null,
    tagNames: essayForm.tagNames,
    title: essayForm.title.trim(),
    visibility: essayForm.visibility,
  };
}

function normalizeCategoryPayload(): EssayCategoryPayload {
  return {
    description: categoryForm.description.trim() || null,
    isEnabled: categoryForm.isEnabled,
    name: categoryForm.name.trim(),
    slug: categoryForm.slug.trim(),
    sortOrder: categoryForm.sortOrder,
  };
}

async function handleCoverSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  uploadingCover.value = true;
  errorMessage.value = '';
  try {
    const result = await uploadImageFile(file);
    essayForm.coverUrl = result.url;
    ElMessage.success('封面已上传');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '上传封面失败';
  } finally {
    uploadingCover.value = false;
    // 清空 input，否则连续选同一个文件不会再触发 change。
    if (input) {
      input.value = '';
    }
  }
}

async function handleSubmitEssay() {
  errorMessage.value = '';
  const valid = essayFormRef.value ? await essayFormRef.value.validate() : true;

  if (!valid) {
    return;
  }

  saving.value = true;

  try {
    const payload = normalizeEssayPayload();

    if (editingEssay.value) {
      await updateEssay(editingEssay.value.id, payload);
      ElMessage.success('随笔已更新');
    } else {
      await createEssay(payload);
      ElMessage.success('随笔已创建');
    }

    essayDialogOpen.value = false;
    await loadEssays();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function handleSubmitCategory() {
  categoryError.value = '';
  const valid = categoryFormRef.value ? await categoryFormRef.value.validate() : true;

  if (!valid) {
    return;
  }

  categorySaving.value = true;

  try {
    const payload = normalizeCategoryPayload();

    if (editingCategory.value) {
      await updateEssayCategory(editingCategory.value.id, payload);
      ElMessage.success('分类已更新');
    } else {
      await createEssayCategory(payload);
      ElMessage.success('分类已创建');
    }

    categoryDialogOpen.value = false;
    await loadCategories();
  } catch (error) {
    categoryError.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    categorySaving.value = false;
  }
}

async function confirmDeleteEssay(item: EssayItem) {
  await ElMessageBox.confirm('确认删除这篇随笔？删除后会进入回收站。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });

  await deleteEssay(item.id);
  ElMessage.success('随笔已删除');
  await loadEssays();
}

async function confirmDisableCategory(item: EssayCategoryItem) {
  await ElMessageBox.confirm('确认停用这个分类？已有随笔不会被删除。', '停用确认', {
    cancelButtonText: '取消',
    confirmButtonText: '停用',
    type: 'warning',
  });

  await deleteEssayCategory(item.id);
  ElMessage.success('分类已停用');
  await loadCategories();
}

defineExpose({
  categoryForm,
  essayForm,
  handleCoverSelected,
  handleSubmitCategory,
  handleSubmitEssay,
  openCreateCategoryDialog,
  openCreateEssayDialog,
});
</script>

<style scoped>
.essay-cover-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
}
</style>
