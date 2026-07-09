<template>
  <section class="admin-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane
        label="回收站"
        name="recycle"
      >
        <div class="page-toolbar">
          <div class="toolbar-filters">
            <el-select
              v-model="recycleFilters.objectType"
              clearable
              placeholder="业务类型"
              style="width: 160px"
              @change="handleRecycleFilterChange"
            >
              <el-option
                v-for="item in targetTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="recycleFilters.search"
              clearable
              placeholder="搜索标题、摘要或 ID"
              style="width: 240px"
              @clear="handleRecycleFilterChange"
              @keyup.enter="handleRecycleFilterChange"
            />
          </div>
          <el-button @click="handleRecycleFilterChange">
            搜索
          </el-button>
        </div>

        <el-table
          v-loading="recycleLoading"
          :data="recycleItems"
          border
          row-key="id"
        >
          <el-table-column
            label="类型"
            width="120"
          >
            <template #default="{ row }">
              <el-tag>{{ targetTypeText(row.objectType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="title"
            label="标题"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="summary"
            label="摘要"
            min-width="220"
            show-overflow-tooltip
          />
          <el-table-column
            prop="objectId"
            label="业务 ID"
            width="100"
          />
          <el-table-column
            label="删除人"
            width="130"
          >
            <template #default="{ row }">
              {{ adminText(row.deletedBy) }}
            </template>
          </el-table-column>
          <el-table-column
            label="删除时间"
            width="180"
          >
            <template #default="{ row }">
              {{ formatDate(row.deletedAt) }}
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            fixed="right"
            width="160"
          >
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="handleRestore(row)"
              >
                恢复
              </el-button>
              <el-button
                link
                type="danger"
                @click="handlePurge(row)"
              >
                彻底删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="table-pagination">
          <el-pagination
            v-model:current-page="recyclePagination.page"
            v-model:page-size="recyclePagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="recyclePagination.total"
            @current-change="loadRecycleItems"
            @size-change="handleRecyclePageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane
        label="操作日志"
        name="logs"
      >
        <div class="page-toolbar">
          <div class="toolbar-filters">
            <el-select
              v-model="logFilters.action"
              clearable
              placeholder="动作"
              style="width: 160px"
              @change="handleLogFilterChange"
            >
              <el-option
                v-for="item in operationTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-select
              v-model="logFilters.objectType"
              clearable
              placeholder="业务类型"
              style="width: 160px"
              @change="handleLogFilterChange"
            >
              <el-option
                v-for="item in targetTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-input
              v-model="logFilters.search"
              clearable
              placeholder="搜索对象 ID 或 IP"
              style="width: 220px"
              @clear="handleLogFilterChange"
              @keyup.enter="handleLogFilterChange"
            />
          </div>
          <el-button @click="handleLogFilterChange">
            搜索
          </el-button>
        </div>

        <el-table
          v-loading="logLoading"
          :data="operationLogs"
          border
          row-key="id"
        >
          <el-table-column
            label="动作"
            width="130"
          >
            <template #default="{ row }">
              <el-tag :type="operationTagType(row.action)">
                {{ operationText(row.action) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="对象"
            min-width="160"
          >
            <template #default="{ row }">
              {{ row.objectType ? targetTypeText(row.objectType) : '系统' }} {{ row.objectId ? `#${row.objectId}` : '' }}
            </template>
          </el-table-column>
          <el-table-column
            label="管理员"
            width="130"
          >
            <template #default="{ row }">
              {{ adminText(row.admin) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="ip"
            label="IP"
            width="150"
            show-overflow-tooltip
          />
          <el-table-column
            label="详情"
            min-width="260"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ detailText(row.detail) }}
            </template>
          </el-table-column>
          <el-table-column
            label="时间"
            width="180"
          >
            <template #default="{ row }">
              {{ formatDate(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>

        <div class="table-pagination">
          <el-pagination
            v-model:current-page="logPagination.page"
            v-model:page-size="logPagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="logPagination.total"
            @current-change="loadOperationLogs"
            @size-change="handleLogPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, reactive, ref, watch } from 'vue';
import {
  listOperationLogs,
  listRecycleBin,
  purgeRecycleBinItem,
  restoreRecycleBinItem,
  type AdminSummary,
  type OperationLogItem,
  type OperationType,
  type RecycleBinItem,
  type TargetType,
} from '../services/recycle-bin';

const activeTab = ref('recycle');
const recycleLoading = ref(false);
const logLoading = ref(false);
const recycleItems = ref<RecycleBinItem[]>([]);
const operationLogs = ref<OperationLogItem[]>([]);
const recyclePagination = reactive({ page: 1, pageSize: 10, total: 0 });
const logPagination = reactive({ page: 1, pageSize: 10, total: 0 });
const recycleFilters = reactive<{ objectType: TargetType | ''; search: string }>({
  objectType: '',
  search: '',
});
const logFilters = reactive<{ action: OperationType | ''; objectType: TargetType | ''; search: string }>({
  action: '',
  objectType: '',
  search: '',
});

const targetTypeOptions: Array<{ label: string; value: TargetType }> = [
  { label: '导航', value: 'NAVIGATION' },
  { label: '自定义页面', value: 'PAGE' },
  { label: '碎碎念', value: 'THOUGHT' },
  { label: '随笔', value: 'ESSAY' },
  { label: '照片', value: 'PHOTO' },
  { label: '留言', value: 'MESSAGE' },
  { label: '评论', value: 'COMMENT' },
  { label: '音乐', value: 'MUSIC' },
  { label: '标签', value: 'TAG' },
  { label: '相册', value: 'ALBUM' },
  { label: '随笔分类', value: 'ESSAY_CATEGORY' },
];

const operationTypeOptions: Array<{ label: string; value: OperationType }> = [
  { label: '登录', value: 'LOGIN' },
  { label: '登出', value: 'LOGOUT' },
  { label: '新增', value: 'CREATE' },
  { label: '编辑', value: 'UPDATE' },
  { label: '删除', value: 'DELETE' },
  { label: '恢复', value: 'RESTORE' },
  { label: '彻底删除', value: 'PERMANENT_DELETE' },
  { label: '审核', value: 'AUDIT' },
  { label: '修改密码', value: 'CHANGE_PASSWORD' },
  { label: '修改设置', value: 'UPDATE_SETTING' },
];

onMounted(() => {
  void loadRecycleItems();
});

watch(activeTab, (tab) => {
  if (tab === 'logs' && operationLogs.value.length === 0) {
    void loadOperationLogs();
  }
});

async function loadRecycleItems() {
  recycleLoading.value = true;
  try {
    const result = await listRecycleBin({
      objectType: recycleFilters.objectType,
      page: recyclePagination.page,
      pageSize: recyclePagination.pageSize,
      search: recycleFilters.search,
    });
    recycleItems.value = result.items;
    recyclePagination.total = result.pagination.total;
  } finally {
    recycleLoading.value = false;
  }
}

async function loadOperationLogs() {
  logLoading.value = true;
  try {
    const result = await listOperationLogs({
      action: logFilters.action,
      objectType: logFilters.objectType,
      page: logPagination.page,
      pageSize: logPagination.pageSize,
      search: logFilters.search,
    });
    operationLogs.value = result.items;
    logPagination.total = result.pagination.total;
  } finally {
    logLoading.value = false;
  }
}

function handleRecycleFilterChange() {
  recyclePagination.page = 1;
  void loadRecycleItems();
}

function handleLogFilterChange() {
  logPagination.page = 1;
  void loadOperationLogs();
}

function handleRecyclePageSizeChange() {
  recyclePagination.page = 1;
  void loadRecycleItems();
}

function handleLogPageSizeChange() {
  logPagination.page = 1;
  void loadOperationLogs();
}

async function handleRestore(item: RecycleBinItem) {
  await ElMessageBox.confirm(`确认恢复「${item.title}」？`, '恢复确认', {
    cancelButtonText: '取消',
    confirmButtonText: '恢复',
    type: 'warning',
  });
  await restoreRecycleBinItem(item.id);
  ElMessage.success('内容已恢复');
  await loadRecycleItems();
}

async function handlePurge(item: RecycleBinItem) {
  await ElMessageBox.confirm(`确认彻底删除「${item.title}」？此操作不可恢复。`, '彻底删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '彻底删除',
    type: 'warning',
  });
  await purgeRecycleBinItem(item.id);
  ElMessage.success('内容已彻底删除');
  await loadRecycleItems();
}

function targetTypeText(type: TargetType) {
  return targetTypeOptions.find((item) => item.value === type)?.label ?? type;
}

function operationText(type: OperationType) {
  return operationTypeOptions.find((item) => item.value === type)?.label ?? type;
}

function operationTagType(type: OperationType) {
  if (type === 'DELETE' || type === 'PERMANENT_DELETE') {
    return 'danger';
  }
  if (type === 'RESTORE' || type === 'CREATE') {
    return 'success';
  }
  if (type === 'AUDIT') {
    return 'warning';
  }

  return 'info';
}

function adminText(admin: AdminSummary | null) {
  return admin?.displayName || admin?.username || '系统';
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString();
}

function detailText(value: unknown) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

defineExpose({
  activeTab,
  handleLogFilterChange,
  handlePurge,
  handleRestore,
  loadOperationLogs,
  loadRecycleItems,
  logFilters,
  recycleFilters,
});
</script>
