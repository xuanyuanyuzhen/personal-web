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
            placeholder="搜索歌曲或歌手"
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
        新增音乐
      </el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      class="dialog-alert"
      type="error"
      :title="errorMessage"
      :closable="false"
    />

    <el-table
      v-loading="loading"
      :data="items"
      border
      row-key="id"
    >
      <el-table-column
        prop="title"
        label="歌曲"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        prop="artist"
        label="歌手"
        min-width="130"
        show-overflow-tooltip
      />
      <el-table-column
        label="音频来源"
        min-width="180"
      >
        <template #default="{ row }">
          <el-tag
            v-if="row.localUrl"
            class="tag-chip"
            type="success"
          >
            本地
          </el-tag>
          <el-tag
            v-if="row.externalUrl"
            class="tag-chip"
          >
            外链
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="歌词"
        width="120"
      >
        <template #default="{ row }">
          {{ row.lyricText || row.lyricFileUrl ? '已配置' : '无' }}
        </template>
      </el-table-column>
      <el-table-column
        prop="sortOrder"
        label="排序"
        width="90"
      />
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
      :title="editingItem ? '编辑音乐' : '新增音乐'"
      width="760px"
      :close-on-click-modal="!saving"
      :teleported="false"
    >
      <el-alert
        v-if="dialogError"
        class="dialog-alert"
        type="error"
        :title="dialogError"
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
            label="歌曲名称"
            prop="title"
          >
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item
            label="歌手"
            prop="artist"
          >
            <el-input v-model="form.artist" />
          </el-form-item>
        </div>

        <el-form-item label="本地音乐文件">
          <div class="music-upload-row">
            <el-input
              v-model="form.localUrl"
              placeholder="/uploads/music/song.mp3"
            />
            <input
              ref="musicInputRef"
              class="visually-hidden"
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/flac"
              @change="handleMusicSelected"
            >
            <el-button
              :loading="uploadingMusic"
              @click="musicInputRef?.click()"
            >
              上传音乐
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="外部音乐链接">
          <el-input
            v-model="form.externalUrl"
            placeholder="https://example.com/song.mp3"
          />
        </el-form-item>

        <div class="form-grid two-columns">
          <el-form-item label="歌词文件">
            <div class="music-upload-row">
              <el-input
                v-model="form.lyricFileUrl"
                placeholder="/uploads/music/song.lrc"
              />
              <input
                ref="lyricInputRef"
                class="visually-hidden"
                type="file"
                accept=".lrc,text/plain"
                @change="handleLyricSelected"
              >
              <el-button
                :loading="uploadingLyric"
                @click="lyricInputRef?.click()"
              >
                上传歌词
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number
              v-model="form.sortOrder"
              controls-position="right"
            />
          </el-form-item>
        </div>

        <el-form-item label="歌词文本">
          <el-input
            v-model="form.lyricText"
            type="textarea"
            :rows="5"
            resize="vertical"
            placeholder="[00:00.00]歌词内容"
          />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch
            v-model="form.isEnabled"
            active-text="启用"
            inactive-text="停用"
          />
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
  createMusic,
  deleteMusic,
  listMusic,
  updateMusic,
  uploadLyricFile,
  uploadMusicFile,
  type MusicItem,
  type MusicPayload,
} from '../services/music';
import { ApiError } from '../services/request';

const loading = ref(false);
const saving = ref(false);
const uploadingMusic = ref(false);
const uploadingLyric = ref(false);
const dialogOpen = ref(false);
const errorMessage = ref('');
const dialogError = ref('');
const searchInput = ref('');
const activeSearch = ref('');
const items = ref<MusicItem[]>([]);
const editingItem = ref<MusicItem | null>(null);
const formRef = ref();
const musicInputRef = ref<HTMLInputElement | null>(null);
const lyricInputRef = ref<HTMLInputElement | null>(null);
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const form = reactive<MusicPayload>(createDefaultForm());

const rules = {
  artist: [{ required: true, message: '请输入歌手', trigger: 'blur' }],
  title: [{ required: true, message: '请输入歌曲名称', trigger: 'blur' }],
};

onMounted(loadData);

function createDefaultForm(): MusicPayload {
  return {
    artist: '',
    externalUrl: '',
    isEnabled: true,
    localUrl: '',
    lyricFileUrl: '',
    lyricText: '',
    sortOrder: 0,
    title: '',
  };
}

async function loadData() {
  loading.value = true;

  try {
    const result = await listMusic({ page: pagination.page, pageSize: pagination.pageSize, search: activeSearch.value });
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

function openCreateDialog() {
  editingItem.value = null;
  resetForm(createDefaultForm());
  dialogOpen.value = true;
}

function openEditDialog(item: MusicItem) {
  editingItem.value = item;
  resetForm({
    artist: item.artist,
    externalUrl: item.externalUrl ?? '',
    isEnabled: item.isEnabled,
    localUrl: item.localUrl ?? '',
    lyricFileUrl: item.lyricFileUrl ?? '',
    lyricText: item.lyricText ?? '',
    sortOrder: item.sortOrder,
    title: item.title,
  });
  dialogOpen.value = true;
}

function resetForm(nextForm: MusicPayload) {
  Object.assign(form, nextForm);
  dialogError.value = '';
  formRef.value?.clearValidate?.();
}

function normalizePayload(): MusicPayload {
  return {
    artist: form.artist.trim(),
    externalUrl: form.externalUrl?.trim() || null,
    isEnabled: form.isEnabled,
    localUrl: form.localUrl?.trim() || null,
    lyricFileUrl: form.lyricFileUrl?.trim() || null,
    lyricText: form.lyricText?.trim() || null,
    sortOrder: form.sortOrder,
    title: form.title.trim(),
  };
}

async function handleSubmit() {
  dialogError.value = '';
  const valid = formRef.value ? await formRef.value.validate() : true;
  if (!valid) {
    return;
  }

  const payload = normalizePayload();
  if (!payload.localUrl && !payload.externalUrl) {
    dialogError.value = '本地音乐文件和外部音乐链接至少填写一种';
    return;
  }

  saving.value = true;
  try {
    if (editingItem.value) {
      await updateMusic(editingItem.value.id, payload);
      ElMessage.success('音乐已更新');
    } else {
      await createMusic(payload);
      ElMessage.success('音乐已创建');
    }
    dialogOpen.value = false;
    await loadData();
  } catch (error) {
    dialogError.value = error instanceof ApiError ? error.message : '保存失败，请稍后重试';
  } finally {
    saving.value = false;
  }
}

async function handleMusicSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  uploadingMusic.value = true;
  dialogError.value = '';
  try {
    const result = await uploadMusicFile(file);
    form.localUrl = result.url;
    if (!form.title) {
      form.title = file.name.replace(/\.[^.]+$/, '');
    }
    ElMessage.success('音乐文件已上传');
  } catch (error) {
    dialogError.value = error instanceof ApiError ? error.message : '上传音乐失败';
  } finally {
    uploadingMusic.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function handleLyricSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  uploadingLyric.value = true;
  dialogError.value = '';
  try {
    const result = await uploadLyricFile(file);
    form.lyricFileUrl = result.url;
    ElMessage.success('歌词文件已上传');
  } catch (error) {
    dialogError.value = error instanceof ApiError ? error.message : '上传歌词失败';
  } finally {
    uploadingLyric.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function confirmDelete(item: MusicItem) {
  await ElMessageBox.confirm('确认删除这首音乐？删除后会进入回收站。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });
  await deleteMusic(item.id);
  ElMessage.success('音乐已删除');
  await loadData();
}

defineExpose({
  form,
  handleLyricSelected,
  handleMusicSelected,
  handleSubmit,
  openCreateDialog,
});
</script>

<style scoped>
.music-upload-row {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
}
</style>
