<template>
  <section class="admin-page">
    <el-tabs v-model="activeTab">
      <el-tab-pane
        label="留言审核"
        name="messages"
      >
        <div class="page-toolbar">
          <el-select
            v-model="messageStatus"
            style="width: 160px"
            @change="handleMessageStatusChange"
          >
            <el-option
              label="全部"
              value=""
            />
            <el-option
              label="待审核"
              value="PENDING"
            />
            <el-option
              label="已通过"
              value="APPROVED"
            />
            <el-option
              label="已拒绝"
              value="REJECTED"
            />
          </el-select>
          <span />
        </div>
        <el-table
          v-loading="messageLoading"
          :data="messages"
          border
          row-key="id"
        >
          <el-table-column
            prop="nickname"
            label="昵称"
            width="120"
          />
          <el-table-column
            prop="email"
            label="邮箱"
            width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="content"
            label="内容"
            min-width="260"
            show-overflow-tooltip
          />
          <el-table-column
            label="状态"
            width="100"
          >
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.auditStatus)">
                {{ statusText(row.auditStatus) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="命中"
            width="170"
          >
            <template #default="{ row }">
              <span v-if="row.blacklistMatched">黑名单</span>
              <span v-else-if="row.hitWords?.length">{{ row.hitWords.join('、') }}</span>
              <span v-else>无</span>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            fixed="right"
            width="210"
          >
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                :disabled="row.auditStatus === 'APPROVED'"
                @click="handleAudit(row.id, 'APPROVED')"
              >
                通过
              </el-button>
              <el-button
                link
                type="danger"
                :disabled="row.auditStatus === 'REJECTED'"
                @click="handleAudit(row.id, 'REJECTED')"
              >
                拒绝
              </el-button>
              <el-button
                link
                type="danger"
                @click="handleDeleteMessage(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination">
          <el-pagination
            v-model:current-page="messagePagination.page"
            v-model:page-size="messagePagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="messagePagination.total"
            @current-change="loadMessages"
            @size-change="handleMessagePageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane
        label="违禁词"
        name="forbidden"
      >
        <div class="page-toolbar">
          <span />
          <el-button
            type="primary"
            @click="openForbiddenDialog()"
          >
            新增违禁词
          </el-button>
        </div>
        <el-table
          v-loading="forbiddenLoading"
          :data="forbiddenWords"
          border
          row-key="id"
        >
          <el-table-column
            prop="word"
            label="词条"
            min-width="160"
          />
          <el-table-column
            label="规则"
            width="130"
          >
            <template #default="{ row }">
              {{ row.ruleType === 'PLAIN' ? '直接命中' : '正则预留' }}
            </template>
          </el-table-column>
          <el-table-column
            prop="note"
            label="备注"
            min-width="180"
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
            label="操作"
            fixed="right"
            width="150"
          >
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="openForbiddenDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="handleDeleteForbidden(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination">
          <el-pagination
            v-model:current-page="forbiddenPagination.page"
            v-model:page-size="forbiddenPagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="forbiddenPagination.total"
            @current-change="loadForbiddenWords"
            @size-change="handleForbiddenPageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane
        label="黑名单"
        name="blacklist"
      >
        <div class="page-toolbar">
          <span />
          <el-button
            type="primary"
            @click="openBlacklistDialog()"
          >
            新增黑名单
          </el-button>
        </div>
        <el-table
          v-loading="blacklistLoading"
          :data="blacklist"
          border
          row-key="id"
        >
          <el-table-column
            label="类型"
            width="130"
          >
            <template #default="{ row }">
              {{ blacklistTypeText(row.type) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="value"
            label="值"
            min-width="180"
          />
          <el-table-column
            prop="note"
            label="备注"
            min-width="180"
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
            label="操作"
            fixed="right"
            width="150"
          >
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                @click="openBlacklistDialog(row)"
              >
                编辑
              </el-button>
              <el-button
                link
                type="danger"
                @click="handleDeleteBlacklist(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="table-pagination">
          <el-pagination
            v-model:current-page="blacklistPagination.page"
            v-model:page-size="blacklistPagination.pageSize"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50]"
            :total="blacklistPagination.total"
            @current-change="loadBlacklist"
            @size-change="handleBlacklistPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="forbiddenDialogOpen"
      :title="editingForbidden ? '编辑违禁词' : '新增违禁词'"
      width="520px"
      :teleported="false"
    >
      <el-form
        label-position="top"
        :model="forbiddenForm"
      >
        <el-form-item label="词条">
          <el-input v-model="forbiddenForm.word" />
        </el-form-item>
        <el-form-item label="规则">
          <el-select
            v-model="forbiddenForm.ruleType"
            style="width: 100%"
          >
            <el-option
              label="直接命中"
              value="PLAIN"
            />
            <el-option
              label="正则预留"
              value="REGEX_RESERVED"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="forbiddenForm.note" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="forbiddenForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forbiddenDialogOpen = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="savingRule"
          @click="handleSubmitForbidden"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="blacklistDialogOpen"
      :title="editingBlacklist ? '编辑黑名单' : '新增黑名单'"
      width="520px"
      :teleported="false"
    >
      <el-form
        label-position="top"
        :model="blacklistForm"
      >
        <el-form-item label="类型">
          <el-select
            v-model="blacklistForm.type"
            style="width: 100%"
          >
            <el-option
              label="昵称"
              value="NAME"
            />
            <el-option
              label="邮箱"
              value="EMAIL"
            />
            <el-option
              label="IP"
              value="IP"
            />
            <el-option
              label="visitorId"
              value="VISITOR_ID"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="blacklistForm.value" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="blacklistForm.note" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="blacklistForm.isEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="blacklistDialogOpen = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="savingRule"
          @click="handleSubmitBlacklist"
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
  auditMessage,
  createBlacklistItem,
  createForbiddenWord,
  deleteMessage,
  deleteBlacklistItem,
  deleteForbiddenWord,
  listBlacklist,
  listForbiddenWords,
  listMessages,
  type AuditStatus,
  type BlacklistItem,
  type BlacklistPayload,
  type BlacklistType,
  type ForbiddenRuleType,
  type ForbiddenWordItem,
  type ForbiddenWordPayload,
  type ManagedMessageItem,
  updateBlacklistItem,
  updateForbiddenWord,
} from '../services/content';

const activeTab = ref('messages');
const messageLoading = ref(false);
const forbiddenLoading = ref(false);
const blacklistLoading = ref(false);
const savingRule = ref(false);
const forbiddenDialogOpen = ref(false);
const blacklistDialogOpen = ref(false);
const messageStatus = ref<AuditStatus | ''>('PENDING');
const messages = ref<ManagedMessageItem[]>([]);
const forbiddenWords = ref<ForbiddenWordItem[]>([]);
const blacklist = ref<BlacklistItem[]>([]);
const editingForbidden = ref<ForbiddenWordItem | null>(null);
const editingBlacklist = ref<BlacklistItem | null>(null);
const messagePagination = reactive({ page: 1, pageSize: 10, total: 0 });
const forbiddenPagination = reactive({ page: 1, pageSize: 10, total: 0 });
const blacklistPagination = reactive({ page: 1, pageSize: 10, total: 0 });
const forbiddenForm = reactive<ForbiddenWordPayload>(createDefaultForbiddenForm());
const blacklistForm = reactive<BlacklistPayload>(createDefaultBlacklistForm());

onMounted(() => {
  void Promise.all([loadMessages(), loadForbiddenWords(), loadBlacklist()]);
});

function createDefaultForbiddenForm(): ForbiddenWordPayload {
  return {
    isEnabled: true,
    note: '',
    ruleType: 'PLAIN',
    word: '',
  };
}

function createDefaultBlacklistForm(): BlacklistPayload {
  return {
    isEnabled: true,
    note: '',
    type: 'EMAIL',
    value: '',
  };
}

async function loadMessages() {
  messageLoading.value = true;
  try {
    const result = await listMessages({
      page: messagePagination.page,
      pageSize: messagePagination.pageSize,
      status: messageStatus.value || undefined,
    });
    messages.value = result.items;
    messagePagination.total = result.pagination.total;
  } finally {
    messageLoading.value = false;
  }
}

async function loadForbiddenWords() {
  forbiddenLoading.value = true;
  try {
    const result = await listForbiddenWords({
      page: forbiddenPagination.page,
      pageSize: forbiddenPagination.pageSize,
    });
    forbiddenWords.value = result.items;
    forbiddenPagination.total = result.pagination.total;
  } finally {
    forbiddenLoading.value = false;
  }
}

async function loadBlacklist() {
  blacklistLoading.value = true;
  try {
    const result = await listBlacklist({
      page: blacklistPagination.page,
      pageSize: blacklistPagination.pageSize,
    });
    blacklist.value = result.items;
    blacklistPagination.total = result.pagination.total;
  } finally {
    blacklistLoading.value = false;
  }
}

function handleMessageStatusChange() {
  messagePagination.page = 1;
  void loadMessages();
}

function handleMessagePageSizeChange() {
  messagePagination.page = 1;
  void loadMessages();
}

function handleForbiddenPageSizeChange() {
  forbiddenPagination.page = 1;
  void loadForbiddenWords();
}

function handleBlacklistPageSizeChange() {
  blacklistPagination.page = 1;
  void loadBlacklist();
}

async function handleAudit(id: number, status: AuditStatus) {
  const reason = status === 'REJECTED' ? '管理员拒绝' : '管理员通过';
  await auditMessage(id, { reason, status });
  ElMessage.success(status === 'APPROVED' ? '留言已通过' : '留言已拒绝');
  await loadMessages();
}

async function handleDeleteMessage(id: number) {
  await ElMessageBox.confirm('确认删除这条留言？删除后会进入回收站。', '删除确认', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  });
  await deleteMessage(id);
  ElMessage.success('留言已删除');
  await loadMessages();
}

function openForbiddenDialog(item?: ForbiddenWordItem) {
  editingForbidden.value = item ?? null;
  Object.assign(forbiddenForm, item ? {
    isEnabled: item.isEnabled,
    note: item.note ?? '',
    ruleType: item.ruleType,
    word: item.word,
  } : createDefaultForbiddenForm());
  forbiddenDialogOpen.value = true;
}

function openBlacklistDialog(item?: BlacklistItem) {
  editingBlacklist.value = item ?? null;
  Object.assign(blacklistForm, item ? {
    isEnabled: item.isEnabled,
    note: item.note ?? '',
    type: item.type,
    value: item.value,
  } : createDefaultBlacklistForm());
  blacklistDialogOpen.value = true;
}

async function handleSubmitForbidden() {
  savingRule.value = true;
  try {
    const payload = normalizeForbiddenPayload();
    if (editingForbidden.value) {
      await updateForbiddenWord(editingForbidden.value.id, payload);
    } else {
      await createForbiddenWord(payload);
    }
    forbiddenDialogOpen.value = false;
    ElMessage.success('违禁词已保存');
    await loadForbiddenWords();
  } finally {
    savingRule.value = false;
  }
}

async function handleSubmitBlacklist() {
  savingRule.value = true;
  try {
    const payload = normalizeBlacklistPayload();
    if (editingBlacklist.value) {
      await updateBlacklistItem(editingBlacklist.value.id, payload);
    } else {
      await createBlacklistItem(payload);
    }
    blacklistDialogOpen.value = false;
    ElMessage.success('黑名单已保存');
    await loadBlacklist();
  } finally {
    savingRule.value = false;
  }
}

async function handleDeleteForbidden(id: number) {
  await ElMessageBox.confirm('确认删除这个违禁词？', '删除确认', { type: 'warning' });
  await deleteForbiddenWord(id);
  ElMessage.success('违禁词已删除');
  await loadForbiddenWords();
}

async function handleDeleteBlacklist(id: number) {
  await ElMessageBox.confirm('确认删除这个黑名单项？', '删除确认', { type: 'warning' });
  await deleteBlacklistItem(id);
  ElMessage.success('黑名单项已删除');
  await loadBlacklist();
}

function normalizeForbiddenPayload(): ForbiddenWordPayload {
  return {
    isEnabled: forbiddenForm.isEnabled,
    note: forbiddenForm.note?.trim() || null,
    ruleType: forbiddenForm.ruleType as ForbiddenRuleType,
    word: forbiddenForm.word.trim(),
  };
}

function normalizeBlacklistPayload(): BlacklistPayload {
  return {
    isEnabled: blacklistForm.isEnabled,
    note: blacklistForm.note?.trim() || null,
    type: blacklistForm.type as BlacklistType,
    value: blacklistForm.value.trim(),
  };
}

function statusText(status: AuditStatus) {
  return status === 'APPROVED' ? '已通过' : status === 'REJECTED' ? '已拒绝' : '待审核';
}

function statusTagType(status: AuditStatus) {
  return status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'danger' : 'warning';
}

function blacklistTypeText(type: BlacklistType) {
  const map: Record<BlacklistType, string> = {
    EMAIL: '邮箱',
    IP: 'IP',
    NAME: '昵称',
    VISITOR_ID: 'visitorId',
  };

  return map[type];
}

defineExpose({
  handleDeleteMessage,
});
</script>
