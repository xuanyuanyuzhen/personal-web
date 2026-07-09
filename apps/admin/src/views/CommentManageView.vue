<template>
  <section class="admin-page">
    <div class="page-toolbar">
      <div class="toolbar-filters">
        <el-select
          v-model="status"
          style="width: 160px"
          @change="handleFilterChange"
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
        <el-input
          v-model="search"
          clearable
          placeholder="搜索评论、昵称或随笔"
          style="width: 260px"
          @clear="handleFilterChange"
          @keyup.enter="handleFilterChange"
        />
      </div>
      <el-button @click="handleFilterChange">
        搜索
      </el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="comments"
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
        label="随笔"
        min-width="180"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          {{ row.essay?.title ?? `#${row.essayId}` }}
        </template>
      </el-table-column>
      <el-table-column
        label="层级"
        width="90"
      >
        <template #default="{ row }">
          {{ row.parentId ? `回复 #${row.parentId}` : '顶层' }}
        </template>
      </el-table-column>
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
        width="160"
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
        width="240"
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
            type="primary"
            @click="openReplyDialog(row)"
          >
            回复
          </el-button>
          <el-button
            link
            @click="openEditDialog(row)"
          >
            编辑
          </el-button>
          <el-button
            link
            type="danger"
            @click="handleDelete(row.id)"
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
        @current-change="loadComments"
        @size-change="handlePageSizeChange"
      />
    </div>

    <el-dialog
      v-model="editDialogOpen"
      title="编辑评论"
      width="520px"
      :teleported="false"
    >
      <el-form
        label-position="top"
        :model="editForm"
      >
        <el-form-item label="昵称">
          <el-input v-model="editForm.nickname" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="4"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogOpen = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmitEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="replyDialogOpen"
      title="回复评论"
      width="520px"
      :teleported="false"
    >
      <el-input
        v-model="replyContent"
        type="textarea"
        :rows="5"
        placeholder="输入后台回复"
      />
      <template #footer>
        <el-button @click="replyDialogOpen = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="handleSubmitReply"
        >
          回复
        </el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { onMounted, reactive, ref } from 'vue';
import {
  auditComment,
  deleteComment,
  listComments,
  replyComment,
  type AuditStatus,
  type ManagedCommentItem,
  updateComment,
} from '../services/content';

const loading = ref(false);
const saving = ref(false);
const status = ref<AuditStatus | ''>('PENDING');
const search = ref('');
const comments = ref<ManagedCommentItem[]>([]);
const editDialogOpen = ref(false);
const replyDialogOpen = ref(false);
const editingComment = ref<ManagedCommentItem | null>(null);
const replyingComment = ref<ManagedCommentItem | null>(null);
const replyContent = ref('');
const pagination = reactive({ page: 1, pageSize: 10, total: 0 });
const editForm = reactive({
  content: '',
  email: '',
  nickname: '',
});

onMounted(() => {
  void loadComments();
});

async function loadComments() {
  loading.value = true;
  try {
    // 后台评论量可能随文章增长较快，统一通过状态、搜索和分页控制列表密度。
    const result = await listComments({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: search.value,
      status: status.value || undefined,
    });
    comments.value = result.items;
    pagination.total = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

function handleFilterChange() {
  pagination.page = 1;
  void loadComments();
}

function handlePageSizeChange() {
  pagination.page = 1;
  void loadComments();
}

async function handleAudit(id: number, nextStatus: AuditStatus) {
  const reason = nextStatus === 'REJECTED' ? '管理员拒绝' : '管理员通过';
  await auditComment(id, { reason, status: nextStatus });
  ElMessage.success(nextStatus === 'APPROVED' ? '评论已通过' : '评论已拒绝');
  await loadComments();
}

function openEditDialog(comment: ManagedCommentItem) {
  editingComment.value = comment;
  Object.assign(editForm, {
    content: comment.content,
    email: comment.email,
    nickname: comment.nickname,
  });
  editDialogOpen.value = true;
}

async function handleSubmitEdit() {
  if (!editingComment.value) {
    return;
  }

  saving.value = true;
  try {
    await updateComment(editingComment.value.id, {
      content: editForm.content.trim(),
      email: editForm.email.trim(),
      nickname: editForm.nickname.trim(),
    });
    editDialogOpen.value = false;
    ElMessage.success('评论已保存');
    await loadComments();
  } finally {
    saving.value = false;
  }
}

function openReplyDialog(comment: ManagedCommentItem) {
  // 回复由后端按当前管理员生成昵称和 visitorId，前端只提交回复正文。
  replyingComment.value = comment;
  replyContent.value = '';
  replyDialogOpen.value = true;
}

async function handleSubmitReply() {
  if (!replyingComment.value) {
    return;
  }

  saving.value = true;
  try {
    await replyComment(replyingComment.value.id, { content: replyContent.value.trim() });
    replyDialogOpen.value = false;
    ElMessage.success('回复已发布');
    await loadComments();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: number) {
  await ElMessageBox.confirm('确认删除这条评论？', '删除确认', { type: 'warning' });
  await deleteComment(id);
  ElMessage.success('评论已删除');
  await loadComments();
}

function statusText(value: AuditStatus) {
  return value === 'APPROVED' ? '已通过' : value === 'REJECTED' ? '已拒绝' : '待审核';
}

function statusTagType(value: AuditStatus) {
  return value === 'APPROVED' ? 'success' : value === 'REJECTED' ? 'danger' : 'warning';
}
</script>
