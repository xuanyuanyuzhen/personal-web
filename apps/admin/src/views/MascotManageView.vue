<template>
  <section class="admin-page mascot-manage-page">
    <el-alert
      v-if="errorMessage"
      class="dialog-alert"
      type="error"
      :title="errorMessage"
      :closable="false"
    />

    <el-tabs v-model="activeTab">
      <el-tab-pane
        label="基础配置"
        name="config"
      >
        <el-form
          ref="configFormRef"
          v-loading="loading"
          label-position="top"
          :model="configForm"
          :rules="configRules"
        >
          <div class="form-grid two-columns">
            <el-form-item
              label="名称"
              prop="name"
            >
              <el-input v-model="configForm.name" />
            </el-form-item>
            <el-form-item label="启用状态">
              <el-switch
                v-model="configForm.isEnabled"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>
          </div>

          <el-form-item label="静态图片">
            <div class="mascot-image-setting">
              <el-input
                v-model="configForm.imageUrl"
                placeholder="/uploads/site/mascot/placeholder.png"
              />
              <input
                ref="mascotInputRef"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                @change="handleMascotSelected"
              >
              <el-button
                :loading="uploading"
                @click="mascotInputRef?.click()"
              >
                上传图片
              </el-button>
            </div>
          </el-form-item>

          <el-form-item label="显示范围">
            <el-checkbox-group v-model="configForm.displayScopes">
              <el-checkbox
                v-for="scope in scopeOptions"
                :key="scope.value"
                :value="scope.value"
              >
                {{ scope.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <el-form-item label="Live2D 预留配置">
            <el-input
              v-model="live2dText"
              type="textarea"
              :rows="4"
              resize="vertical"
            />
          </el-form-item>

          <div class="form-actions">
            <el-button
              type="primary"
              :loading="savingConfig"
              @click="handleSaveConfig"
            >
              保存配置
            </el-button>
          </div>
        </el-form>
      </el-tab-pane>

      <el-tab-pane
        label="台词配置"
        name="lines"
      >
        <div class="mascot-line-layout">
          <el-form
            ref="lineFormRef"
            class="mascot-line-form"
            label-position="top"
            :model="lineForm"
            :rules="lineRules"
          >
            <div class="form-grid two-columns">
              <el-form-item label="类型">
                <el-select v-model="lineForm.isRandom">
                  <el-option
                    label="页面台词"
                    :value="false"
                  />
                  <el-option
                    label="随机台词"
                    :value="true"
                  />
                </el-select>
              </el-form-item>
              <el-form-item
                label="页面标识"
                prop="pageKey"
              >
                <el-select
                  v-model="lineForm.pageKey"
                  filterable
                  allow-create
                >
                  <el-option
                    v-for="scope in linePageOptions"
                    :key="scope.value"
                    :label="scope.label"
                    :value="scope.value"
                  />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item
              label="文案"
              prop="content"
            >
              <el-input
                v-model="lineForm.content"
                type="textarea"
                :rows="3"
                resize="vertical"
              />
            </el-form-item>

            <div class="form-grid three-columns">
              <el-form-item label="权重">
                <el-input-number
                  v-model="lineForm.weight"
                  :min="1"
                  :step="1"
                />
              </el-form-item>
              <el-form-item label="排序">
                <el-input-number
                  v-model="lineForm.sortOrder"
                  :step="1"
                />
              </el-form-item>
              <el-form-item label="启用状态">
                <el-switch
                  v-model="lineForm.isEnabled"
                  active-text="启用"
                  inactive-text="禁用"
                />
              </el-form-item>
            </div>

            <div class="form-actions">
              <el-button @click="resetLineForm">
                新建台词
              </el-button>
              <el-button
                type="primary"
                :loading="savingLine"
                @click="handleSaveLine"
              >
                {{ lineForm.id ? '保存台词' : '新增台词' }}
              </el-button>
            </div>
          </el-form>

          <el-table
            v-loading="loadingLines"
            :data="lines"
            row-key="id"
          >
            <el-table-column
              prop="content"
              label="文案"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column
              label="类型"
              width="96"
            >
              <template #default="{ row }">
                <el-tag :type="row.isRandom ? 'warning' : 'success'">
                  {{ row.isRandom ? '随机' : '页面' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="pageKey"
              label="页面标识"
              width="120"
            />
            <el-table-column
              prop="weight"
              label="权重"
              width="80"
            />
            <el-table-column
              prop="sortOrder"
              label="排序"
              width="80"
            />
            <el-table-column
              label="状态"
              width="90"
            >
              <template #default="{ row }">
                <el-tag :type="row.isEnabled ? 'success' : 'info'">
                  {{ row.isEnabled ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              label="操作"
              width="150"
              fixed="right"
            >
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click="editLine(row)"
                >
                  编辑
                </el-button>
                <el-button
                  link
                  type="danger"
                  @click="handleDeleteLine(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, reactive, ref, watch } from 'vue';
import { ApiError } from '../services/request';
import {
  createMascotLine,
  deleteMascotLine,
  getMascotConfig,
  listMascotLines,
  updateMascotConfig,
  updateMascotLine,
  uploadMascotFile,
  type MascotLine,
} from '../services/mascot';

const scopeOptions = [
  { label: '全部页面', value: '*' },
  { label: '首页', value: 'home' },
  { label: '碎碎念', value: 'thoughts' },
  { label: '随笔列表', value: 'essays' },
  { label: '随笔详情', value: 'essay-detail' },
  { label: '照片墙', value: 'photos' },
  { label: '留言板', value: 'messages' },
  { label: '关于我', value: 'about' },
  { label: '自定义页面', value: 'custom-page' },
  { label: '搜索', value: 'search' },
];
const linePageOptions = [{ label: '通用', value: '*' }, ...scopeOptions.filter((item) => item.value !== '*')];

const activeTab = ref('config');
const loading = ref(false);
const loadingLines = ref(false);
const savingConfig = ref(false);
const savingLine = ref(false);
const uploading = ref(false);
const errorMessage = ref('');
const live2dText = ref('{"reserved":true}');
const lines = ref<MascotLine[]>([]);
const configFormRef = ref();
const lineFormRef = ref();
const mascotInputRef = ref<HTMLInputElement | null>(null);

const configForm = reactive({
  displayScopes: ['*'] as string[],
  imageUrl: '',
  isEnabled: true,
  name: '',
});

const lineForm = reactive({
  content: '',
  id: 0,
  isEnabled: true,
  isRandom: false,
  pageKey: 'home',
  sortOrder: 0,
  weight: 1,
});

const configRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
};

const lineRules = {
  content: [{ required: true, message: '请输入台词文案', trigger: 'blur' }],
  pageKey: [{ required: true, message: '请选择页面标识', trigger: 'change' }],
};

onMounted(async () => {
  await Promise.all([loadConfig(), loadLines()]);
});

watch(
  () => lineForm.isRandom,
  (isRandom) => {
    if (isRandom && lineForm.pageKey !== '*') {
      lineForm.pageKey = '*';
    }
    if (!isRandom && lineForm.pageKey === '*') {
      lineForm.pageKey = 'home';
    }
  },
);

async function loadConfig() {
  loading.value = true;
  errorMessage.value = '';

  try {
    const config = await getMascotConfig();
    Object.assign(configForm, {
      displayScopes: config.displayScopes,
      imageUrl: config.imageUrl ?? '',
      isEnabled: config.isEnabled,
      name: config.name,
    });
    live2dText.value = JSON.stringify(config.live2dConfig ?? { reserved: true }, null, 2);
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '加载看板娘配置失败';
  } finally {
    loading.value = false;
  }
}

async function loadLines() {
  loadingLines.value = true;

  try {
    lines.value = await listMascotLines();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '加载台词失败';
  } finally {
    loadingLines.value = false;
  }
}

async function handleSaveConfig() {
  errorMessage.value = '';
  const valid = configFormRef.value ? await configFormRef.value.validate() : true;
  if (!valid) {
    return;
  }

  let live2dConfig: Record<string, unknown> | null = null;
  try {
    live2dConfig = JSON.parse(live2dText.value || '{"reserved":true}') as Record<string, unknown>;
  } catch {
    errorMessage.value = 'Live2D 预留配置必须是合法 JSON';
    return;
  }

  savingConfig.value = true;
  try {
    const config = await updateMascotConfig({
      displayScopes: configForm.displayScopes,
      imageUrl: configForm.imageUrl || null,
      isEnabled: configForm.isEnabled,
      live2dConfig,
      name: configForm.name,
    });
    Object.assign(configForm, {
      displayScopes: config.displayScopes,
      imageUrl: config.imageUrl ?? '',
      isEnabled: config.isEnabled,
      name: config.name,
    });
    ElMessage.success('看板娘配置已保存');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存看板娘配置失败';
  } finally {
    savingConfig.value = false;
  }
}

async function handleMascotSelected(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  uploading.value = true;
  errorMessage.value = '';

  try {
    const result = await uploadMascotFile(file);
    configForm.imageUrl = result.url;
    ElMessage.success('看板娘图片已上传');
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '上传看板娘图片失败';
  } finally {
    uploading.value = false;
    if (input) {
      input.value = '';
    }
  }
}

async function handleSaveLine() {
  errorMessage.value = '';
  const valid = lineFormRef.value ? await lineFormRef.value.validate() : true;
  if (!valid) {
    return;
  }

  savingLine.value = true;
  try {
    const payload = {
      content: lineForm.content,
      isEnabled: lineForm.isEnabled,
      isRandom: lineForm.isRandom,
      pageKey: lineForm.isRandom ? '*' : lineForm.pageKey,
      sortOrder: lineForm.sortOrder,
      weight: lineForm.weight,
    };

    if (lineForm.id) {
      await updateMascotLine(lineForm.id, payload);
      ElMessage.success('台词已保存');
    } else {
      await createMascotLine(payload);
      ElMessage.success('台词已新增');
    }

    resetLineForm();
    await loadLines();
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '保存台词失败';
  } finally {
    savingLine.value = false;
  }
}

function editLine(line: MascotLine) {
  Object.assign(lineForm, {
    content: line.content,
    id: line.id,
    isEnabled: line.isEnabled,
    isRandom: line.isRandom,
    pageKey: line.pageKey,
    sortOrder: line.sortOrder,
    weight: line.weight,
  });
}

function resetLineForm() {
  Object.assign(lineForm, {
    content: '',
    id: 0,
    isEnabled: true,
    isRandom: false,
    pageKey: 'home',
    sortOrder: 0,
    weight: 1,
  });
}

async function handleDeleteLine(line: MascotLine) {
  await ElMessageBox.confirm(`确认删除台词「${line.content.slice(0, 20)}」吗？`, '删除台词', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  });
  await deleteMascotLine(line.id);
  ElMessage.success('台词已删除');
  await loadLines();
}

defineExpose({
  configForm,
  handleSaveConfig,
  handleSaveLine,
  lineForm,
});
</script>

<style scoped>
.mascot-manage-page {
  min-width: 0;
}

.mascot-image-setting {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  width: 100%;
}

.mascot-line-layout {
  display: grid;
  gap: 18px;
}

.mascot-line-form {
  border-bottom: 1px solid #edf1f7;
  padding-bottom: 18px;
}

.three-columns {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
</style>
