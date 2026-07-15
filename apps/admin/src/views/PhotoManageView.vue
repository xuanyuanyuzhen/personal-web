<template>
  <section class="admin-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane
        label="照片"
        name="photos"
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
                placeholder="搜索标题或描述"
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
          <div class="toolbar-actions">
            <input
              ref="photoInputRef"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              @change="handleFilesSelected"
            >
            <el-button
              :loading="uploading"
              @click="photoInputRef?.click()"
            >
              批量上传
            </el-button>
            <el-button
              type="primary"
              @click="openCreatePhotoDialog"
            >
              新增照片
            </el-button>
          </div>
        </div>

        <el-table
          v-loading="loading || sorting"
          :data="photos"
          border
          row-key="id"
        >
          <el-table-column
            label="拖拽"
            width="72"
          >
            <template #default="{ row }">
              <button
                class="photo-drag-handle"
                type="button"
                draggable="true"
                title="拖拽排序"
                @dragstart="handlePhotoDragStart(row, $event)"
                @dragover.prevent
                @drop.prevent="handlePhotoDrop(row)"
                @dragend="handlePhotoDragEnd"
              >
                <span aria-hidden="true" />
              </button>
            </template>
          </el-table-column>
          <el-table-column
            label="预览"
            width="96"
          >
            <template #default="{ row }">
              <img
                class="admin-photo-thumb"
                :src="row.thumbUrl || row.largeUrl || row.originalUrl"
                alt=""
              >
            </template>
          </el-table-column>
          <el-table-column
            prop="title"
            label="标题"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            label="相册"
            width="130"
          >
            <template #default="{ row }">
              {{ row.album?.name ?? '未分组' }}
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
                @click="openEditPhotoDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="confirmDeletePhoto(row)"
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
            @current-change="loadPhotos"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane
        label="相册"
        name="albums"
      >
        <div class="page-toolbar">
          <span />
          <el-button
            type="primary"
            @click="openCreateAlbumDialog"
          >
            新增相册
          </el-button>
        </div>
        <el-table
          v-loading="albumLoading"
          :data="albums"
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
            min-width="150"
          />
          <el-table-column
            label="状态"
            width="100"
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
                @click="openEditAlbumDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="confirmDisableAlbum(row)"
              >
                停用
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination">
          <el-pagination
            v-model:current-page="albumPagination.page"
            v-model:page-size="albumPagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="albumPagination.total"
            @current-change="handleAlbumPageChange"
            @size-change="handleAlbumPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="photoDialogOpen"
      :title="editingPhoto ? '编辑照片' : '新增照片'"
      width="720px"
      :close-on-click-modal="!saving && !dialogUploading"
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
        ref="photoFormRef"
        label-position="top"
        :model="photoForm"
        :rules="photoRules"
      >
        <div class="form-grid two-columns">
          <el-form-item
            label="标题"
            prop="title"
          >
            <el-input v-model="photoForm.title" />
          </el-form-item>
          <el-form-item label="相册">
            <el-select
              v-model="photoForm.albumId"
              clearable
              placeholder="未分组"
              style="width: 100%"
            >
              <el-option
                v-for="album in enabledAlbums"
                :key="album.id"
                :label="album.name"
                :value="album.id"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="描述">
          <el-input
            v-model="photoForm.description"
            type="textarea"
            :rows="2"
            resize="vertical"
          />
        </el-form-item>
        <el-form-item label="图片文件">
          <div class="photo-dialog-upload">
            <input
              ref="dialogPhotoInputRef"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              @change="handleDialogPhotoSelected"
            >
            <el-button
              :loading="dialogUploading"
              @click="dialogPhotoInputRef?.click()"
            >
              选择图片并上传
            </el-button>
            <span>{{ selectedPhotoName || '支持 JPG、PNG、WebP、GIF，最大 10MB' }}</span>
          </div>
          <img
            v-if="photoForm.thumbUrl || photoForm.largeUrl || photoForm.originalUrl"
            class="photo-dialog-preview"
            :src="photoForm.thumbUrl || photoForm.largeUrl || photoForm.originalUrl"
            alt="照片预览"
          >
        </el-form-item>
        <div class="form-grid two-columns">
          <el-form-item label="状态">
            <el-select
              v-model="photoForm.status"
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
              v-model="photoForm.visibility"
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
        </div>
        <div class="form-grid two-columns">
          <el-form-item label="排序">
            <el-input-number
              v-model="photoForm.sortOrder"
              :min="0"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item
            label="原图地址"
            prop="originalUrl"
          >
            <el-input v-model="photoForm.originalUrl" />
          </el-form-item>
        </div>
        <div class="form-grid two-columns">
          <el-form-item label="大图地址">
            <el-input v-model="photoForm.largeUrl" />
          </el-form-item>
          <el-form-item label="缩略图地址">
            <el-input v-model="photoForm.thumbUrl" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button
          :disabled="saving || dialogUploading"
          @click="photoDialogOpen = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="dialogUploading"
          @click="handleSubmitPhoto"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="albumDialogOpen"
      :title="editingAlbum ? '编辑相册' : '新增相册'"
      width="620px"
      :close-on-click-modal="!albumSaving"
      :teleported="false"
    >
      <el-form
        ref="albumFormRef"
        label-position="top"
        :model="albumForm"
        :rules="albumRules"
      >
        <div class="form-grid two-columns">
          <el-form-item
            label="名称"
            prop="name"
          >
            <el-input v-model="albumForm.name" />
          </el-form-item>
          <el-form-item
            label="Slug"
            prop="slug"
          >
            <el-input v-model="albumForm.slug" />
          </el-form-item>
        </div>
        <el-form-item label="描述">
          <el-input
            v-model="albumForm.description"
            type="textarea"
            :rows="2"
            resize="vertical"
          />
        </el-form-item>
        <el-form-item label="封面地址">
          <el-input v-model="albumForm.coverUrl" />
        </el-form-item>
        <div class="form-grid two-columns">
          <el-form-item label="状态">
            <el-select
              v-model="albumForm.status"
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
              v-model="albumForm.visibility"
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
        </div>
        <div class="form-grid two-columns">
          <el-form-item label="排序">
            <el-input-number
              v-model="albumForm.sortOrder"
              :min="0"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="albumForm.isEnabled" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button
          :disabled="albumSaving"
          @click="albumDialogOpen = false"
        >
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="albumSaving"
          @click="handleSubmitAlbum"
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
  createAlbum,
  createPhoto,
  deleteAlbum,
  deletePhoto,
  listAlbums,
  listPhotos,
  sortPhotos,
  type AlbumItem,
  type AlbumPayload,
  type PhotoItem,
  type PhotoPayload,
  updateAlbum,
  updatePhoto,
  uploadPhotoFile,
} from '../services/content';
import { ApiError } from '../services/request';

type PhotoForm = PhotoPayload;
type AlbumForm = AlbumPayload;

const activeTab = ref('photos');
const loading = ref(false);
const saving = ref(false);
const sorting = ref(false);
const uploading = ref(false);
const dialogUploading = ref(false);
const albumLoading = ref(false);
const albumSaving = ref(false);
const photoDialogOpen = ref(false);
const albumDialogOpen = ref(false);
const errorMessage = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const photos = ref<PhotoItem[]>([]);
const albums = ref<AlbumItem[]>([]);
const albumPagination = reactive({ page: 1, pageSize: 10, total: 0 });
const albumOptions = ref<AlbumItem[]>([]);
const draggingPhotoId = ref<number | null>(null);
const editingPhoto = ref<PhotoItem | null>(null);
const editingAlbum = ref<AlbumItem | null>(null);
const photoFormRef = ref();
const albumFormRef = ref();
const photoInputRef = ref<HTMLInputElement | null>(null);
const dialogPhotoInputRef = ref<HTMLInputElement | null>(null);
const selectedPhotoName = ref('');
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const photoForm = reactive<PhotoForm>(createDefaultPhotoForm());
const albumForm = reactive<AlbumForm>(createDefaultAlbumForm());
const enabledAlbums = computed(() => albumOptions.value.filter((album) => album.isEnabled));

const photoRules = {
  originalUrl: [{ required: true, message: '请上传图片或填写原图地址', trigger: 'blur' }],
  title: [{ required: true, message: '请输入照片标题', trigger: 'blur' }],
};
const albumRules = {
  name: [{ required: true, message: '请输入相册名称', trigger: 'blur' }],
  slug: [{ required: true, message: '请输入相册 Slug', trigger: 'blur' }],
};

onMounted(() => {
  void Promise.all([loadPhotos(), loadAlbums(), loadAlbumOptions()]);
});

function createDefaultPhotoForm(): PhotoForm {
  return {
    albumId: null,
    description: '',
    largeUrl: '',
    originalUrl: '',
    sortOrder: 0,
    status: 'PUBLISHED',
    thumbUrl: '',
    title: '',
    visibility: 'PUBLIC',
  };
}

function createDefaultAlbumForm(): AlbumForm {
  return {
    coverUrl: '',
    description: '',
    isEnabled: true,
    name: '',
    slug: '',
    sortOrder: 0,
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
  };
}

async function loadPhotos() {
  loading.value = true;
  try {
    const result = await listPhotos({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: activeSearch.value,
    });
    photos.value = result.items;
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

async function loadAlbums() {
  albumLoading.value = true;
  try {
    const result = await listAlbums({
      page: albumPagination.page,
      pageSize: albumPagination.pageSize,
    });
    albums.value = result.items;
    albumPagination.total = result.pagination.total;
  } finally {
    albumLoading.value = false;
  }
}

async function loadAlbumOptions() {
  const result = await listAlbums({ page: 1, pageSize: 100 });
  albumOptions.value = result.items;
}

function handleSearch() {
  activeSearch.value = searchInput.value;
  pagination.page = 1;
  void loadPhotos();
}

function handleResetSearch() {
  searchInput.value = '';
  activeSearch.value = '';
  pagination.page = 1;
  void loadPhotos();
}

function handlePageSizeChange() {
  pagination.page = 1;
  void loadPhotos();
}

function handlePhotoDragStart(item: PhotoItem, event: DragEvent) {
  if (sorting.value || photos.value.length < 2) {
    event.preventDefault();
    return;
  }

  draggingPhotoId.value = item.id;
  event.dataTransfer?.setData('text/plain', String(item.id));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

function handlePhotoDragEnd() {
  draggingPhotoId.value = null;
}

async function handlePhotoDrop(target: PhotoItem) {
  const sourceId = draggingPhotoId.value;
  if (!sourceId || sourceId === target.id || sorting.value) {
    return;
  }

  const sourceIndex = photos.value.findIndex((photo) => photo.id === sourceId);
  const targetIndex = photos.value.findIndex((photo) => photo.id === target.id);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const nextPhotos = [...photos.value];
  const [movedPhoto] = nextPhotos.splice(sourceIndex, 1);
  nextPhotos.splice(targetIndex, 0, movedPhoto);

  const startOrder = (pagination.page - 1) * pagination.pageSize;
  const orderedPhotos = nextPhotos.map((photo, index) => ({
    ...photo,
    sortOrder: startOrder + index,
  }));
  photos.value = orderedPhotos;
  sorting.value = true;

  try {
    await sortPhotos({
      items: orderedPhotos.map((photo) => ({ id: photo.id, sortOrder: photo.sortOrder })),
    });
    ElMessage.success('照片排序已保存');
    await loadPhotos();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '排序保存失败，请稍后重试';
    await loadPhotos();
  } finally {
    sorting.value = false;
    draggingPhotoId.value = null;
  }
}

function handleAlbumPageChange() {
  void loadAlbums();
}

function handleAlbumPageSizeChange() {
  albumPagination.page = 1;
  void loadAlbums();
}

function resetPhotoForm(next: PhotoForm) {
  Object.assign(photoForm, next);
  errorMessage.value = '';
  photoFormRef.value?.clearValidate?.();
}

function resetAlbumForm(next: AlbumForm) {
  Object.assign(albumForm, next);
  albumFormRef.value?.clearValidate?.();
}

function openCreatePhotoDialog() {
  editingPhoto.value = null;
  selectedPhotoName.value = '';
  resetPhotoForm(createDefaultPhotoForm());
  photoDialogOpen.value = true;
}

function openEditPhotoDialog(item: PhotoItem) {
  editingPhoto.value = item;
  selectedPhotoName.value = '';
  resetPhotoForm({
    albumId: item.albumId,
    description: item.description ?? '',
    largeUrl: item.largeUrl ?? '',
    originalUrl: item.originalUrl,
    sortOrder: item.sortOrder,
    status: item.status,
    thumbUrl: item.thumbUrl ?? '',
    title: item.title,
    visibility: item.visibility,
  });
  photoDialogOpen.value = true;
}

function openCreateAlbumDialog() {
  editingAlbum.value = null;
  resetAlbumForm(createDefaultAlbumForm());
  albumDialogOpen.value = true;
}

function openEditAlbumDialog(item: AlbumItem) {
  editingAlbum.value = item;
  resetAlbumForm({
    coverUrl: item.coverUrl ?? '',
    description: item.description ?? '',
    isEnabled: item.isEnabled,
    name: item.name,
    slug: item.slug,
    sortOrder: item.sortOrder,
    status: item.status,
    visibility: item.visibility,
  });
  albumDialogOpen.value = true;
}

function normalizePhotoPayload(): PhotoPayload {
  return {
    albumId: photoForm.albumId,
    description: photoForm.description?.trim() || null,
    largeUrl: photoForm.largeUrl?.trim() || null,
    originalUrl: photoForm.originalUrl.trim(),
    sortOrder: photoForm.sortOrder,
    status: photoForm.status,
    thumbUrl: photoForm.thumbUrl?.trim() || null,
    title: photoForm.title.trim(),
    visibility: photoForm.visibility,
  };
}

function normalizeAlbumPayload(): AlbumPayload {
  return {
    coverUrl: albumForm.coverUrl?.trim() || null,
    description: albumForm.description?.trim() || null,
    isEnabled: albumForm.isEnabled,
    name: albumForm.name.trim(),
    slug: albumForm.slug.trim(),
    sortOrder: albumForm.sortOrder,
    status: albumForm.status,
    visibility: albumForm.visibility,
  };
}

async function handleSubmitPhoto() {
  errorMessage.value = '';
  const valid = photoFormRef.value ? await photoFormRef.value.validate() : true;
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = normalizePhotoPayload();
    if (editingPhoto.value) {
      await updatePhoto(editingPhoto.value.id, payload);
      ElMessage.success('照片已更新');
    } else {
      await createPhoto(payload);
      ElMessage.success('照片已创建');
    }
    photoDialogOpen.value = false;
    await loadPhotos();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function handleSubmitAlbum() {
  const valid = albumFormRef.value ? await albumFormRef.value.validate() : true;
  if (!valid) {
    return;
  }

  albumSaving.value = true;
  try {
    const payload = normalizeAlbumPayload();
    if (editingAlbum.value) {
      await updateAlbum(editingAlbum.value.id, payload);
      ElMessage.success('相册已更新');
    } else {
      await createAlbum(payload);
      ElMessage.success('相册已创建');
    }
    albumDialogOpen.value = false;
    await Promise.all([loadAlbums(), loadAlbumOptions()]);
  } finally {
    albumSaving.value = false;
  }
}

async function handleFilesSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const files = [...(input?.files ?? [])];
  if (files.length === 0) {
    return;
  }

  uploading.value = true;
  try {
    for (const file of files) {
      const upload = await uploadPhotoFile(file);
      await createPhoto({
        albumId: null,
        description: null,
        largeUrl: upload.large.url,
        originalUrl: upload.original.url,
        sortOrder: 0,
        status: 'PUBLISHED',
        thumbUrl: upload.thumb.url,
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
        visibility: 'PUBLIC',
      });
    }
    ElMessage.success('照片已上传');
    await loadPhotos();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '上传失败，请稍后重试';
  } finally {
    uploading.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function handleDialogPhotoSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  dialogUploading.value = true;
  errorMessage.value = '';
  try {
    const upload = await uploadPhotoFile(file);
    photoForm.originalUrl = upload.original.url;
    photoForm.largeUrl = upload.large.url;
    photoForm.thumbUrl = upload.thumb.url;
    selectedPhotoName.value = file.name;
    if (!photoForm.title.trim()) {
      photoForm.title = file.name.replace(/\.[^.]+$/, '') || file.name;
    }
    photoFormRef.value?.clearValidate?.('originalUrl');
    ElMessage.success('图片上传成功，保存后发布到照片墙');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '图片上传失败，请稍后重试';
  } finally {
    dialogUploading.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function confirmDeletePhoto(item: PhotoItem) {
  await ElMessageBox.confirm('确认删除这张照片？删除后会进入回收站。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });
  await deletePhoto(item.id);
  ElMessage.success('照片已删除');
  await loadPhotos();
}

async function confirmDisableAlbum(item: AlbumItem) {
  await ElMessageBox.confirm('确认停用这个相册？照片不会被删除。', '停用确认', {
    cancelButtonText: '取消',
    confirmButtonText: '停用',
    type: 'warning',
  });
  await deleteAlbum(item.id);
  ElMessage.success('相册已停用');
  await Promise.all([loadAlbums(), loadAlbumOptions()]);
}

defineExpose({
  albumForm,
  handleFilesSelected,
  handleDialogPhotoSelected,
  handleSubmitAlbum,
  handleSubmitPhoto,
  openCreateAlbumDialog,
  openCreatePhotoDialog,
  photoForm,
});
</script>
