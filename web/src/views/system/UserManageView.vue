<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit } from '@element-plus/icons-vue'
import { createSystemUser, deleteSystemUser, fetchRoles, fetchSystemUsers, updateSystemUser, updateSystemUsersStatusBatch } from '../../api/auth'
import { fetchDepartmentTree } from '../../api/departments'
import { hasPermission } from '../../utils/permissions'
import type { DepartmentTreeItem, RoleOption, SystemUserItem, SystemUserPayload, UserStatusCode } from '../../types'

const canViewUsers = () => hasPermission('system.users.view')
const canCreateUsers = () => hasPermission('system.users.create')
const canEditUsers = () => hasPermission('system.users.edit')
const canDeleteUsers = () => hasPermission('system.users.delete')
const canChangeUserStatus = () => hasPermission('system.users.status')

const loading = ref(false)
const saving = ref(false)
const users = ref<SystemUserItem[]>([])
const roles = ref<RoleOption[]>([])
const departments = ref<DepartmentTreeItem[]>([])
const keyword = ref('')
const roleFilter = ref('')
const statusFilter = ref<UserStatusCode | ''>('')
const quickStatusFilter = ref<UserStatusCode | 'ALL'>('ALL')
const selectedUserIds = ref<number[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]
const dialogVisible = ref(false)
const editingUserId = ref<number | null>(null)
const form = reactive<SystemUserPayload>({
  password: '',
  realName: '',
  phone: '',
  department: '',
  departmentId: undefined,
  roleId: 0,
  status: 'PENDING',
})

const statusLabelMap: Record<UserStatusCode, string> = {
  PENDING: '待审核',
  ACTIVE: '在职',
  DISABLED: '离职',
}

const statusOptions: Array<{ label: string; value: UserStatusCode }> = [
  { label: '待审核', value: 'PENDING' },
  { label: '在职', value: 'ACTIVE' },
  { label: '离职', value: 'DISABLED' },
]

const flattenDepartments = (nodes: DepartmentTreeItem[], depth = 0): Array<{ id: number; name: string; plainName: string }> =>
  nodes.flatMap((node) => [
    { id: node.id, name: `${'— '.repeat(depth)}${node.name}`, plainName: node.name },
    ...(node.children?.length ? flattenDepartments(node.children, depth + 1) : []),
  ])

const departmentOptions = computed(() => flattenDepartments(departments.value))

const getStatusLabel = (status: UserStatusCode) => statusLabelMap[status]

const syncQuickStatusFilter = () => {
  quickStatusFilter.value = statusFilter.value || 'ALL'
}

const loadUsers = async () => {
  if (!canViewUsers()) {
    users.value = []
    roles.value = []
    departments.value = []
    return
  }

  loading.value = true
  try {
    const userList = await fetchSystemUsers()
    users.value = userList

    if (hasPermission('system.roles.view')) {
      roles.value = await fetchRoles()
    } else {
      roles.value = []
    }

    if (hasPermission('system.departments.view')) {
      departments.value = await fetchDepartmentTree()
    } else {
      departments.value = []
    }
  } finally {
    loading.value = false
  }
}

const roleOptions = computed(() => Array.from(new Set(users.value.map((item) => item.roleName).filter(Boolean))))

const filteredUsers = computed(() => {
  const keywordValue = keyword.value.trim().toLowerCase()

  return users.value.filter((item) => {
    const matchesKeyword =
      !keywordValue ||
      item.realName.toLowerCase().includes(keywordValue) ||
      item.phone?.toLowerCase().includes(keywordValue) ||
      item.department?.toLowerCase().includes(keywordValue)

    const matchesRole = !roleFilter.value || item.roleName === roleFilter.value
    const matchesStatus = !statusFilter.value || item.status === statusFilter.value

    return matchesKeyword && matchesRole && matchesStatus
  })
})

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredUsers.value.slice(start, start + pageSize.value)
})

watch(filteredUsers, (value) => {
  const totalPages = Math.max(1, Math.ceil(value.length / pageSize.value))
  if (currentPage.value > totalPages) {
    currentPage.value = totalPages
  }
}, { immediate: true })

watch(pageSize, () => {
  currentPage.value = 1
})

function setQuickStatusFilter(value: UserStatusCode | 'ALL') {
  quickStatusFilter.value = value
  statusFilter.value = value === 'ALL' ? '' : value
  selectedUserIds.value = []
}

const resetFilters = () => {
  keyword.value = ''
  roleFilter.value = ''
  statusFilter.value = ''
  quickStatusFilter.value = 'ALL'
  currentPage.value = 1
}

const handleSelectionChange = (rows: SystemUserItem[]) => {
  selectedUserIds.value = rows.map((item) => item.id)
}

const resetForm = () => {
  editingUserId.value = null
  form.password = ''
  form.realName = ''
  form.phone = ''
  form.department = ''
  form.departmentId = undefined
  form.roleId = roles.value[0]?.id || 0
  form.status = 'PENDING'
}

const openCreateDialog = () => {
  if (!canCreateUsers()) {
    return
  }
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (user: SystemUserItem) => {
  if (!canEditUsers()) {
    return
  }
  editingUserId.value = user.id
  form.password = ''
  form.realName = user.realName
  form.phone = user.phone || ''
  form.department = user.department || ''
  form.departmentId = user.departmentId
  form.roleId = roles.value.find((item) => item.code === user.roleCode)?.id || roles.value[0]?.id || 0
  form.status = user.status
  dialogVisible.value = true
}

const updateUserStatus = async (user: SystemUserItem, status: SystemUserItem['status'], successMessage: string) => {
  await updateSystemUsersStatusBatch({
    userIds: [user.id],
    status,
  })
  ElMessage.success(successMessage)
  await loadUsers()
}

const approveUser = async (user: SystemUserItem) => {
  if (!canChangeUserStatus()) {
    return
  }
  await updateUserStatus(user, 'ACTIVE', '审核已通过')
}

const rejectUser = async (user: SystemUserItem) => {
  if (!canChangeUserStatus()) {
    return
  }
  await updateUserStatus(user, 'DISABLED', '已驳回并标记为离职')
}

const runBatchStatusUpdate = async (status: UserStatusCode, successMessage: string) => {
  if (!selectedUserIds.value.length) {
    ElMessage.warning('请先选择用户')
    return
  }

  const userIds = [...selectedUserIds.value]
  await updateSystemUsersStatusBatch({
    userIds,
    status,
  })
  ElMessage.success(successMessage)
  selectedUserIds.value = []
  await loadUsers()
}

const approveSelectedUsers = async () => {
  if (!canChangeUserStatus()) {
    return
  }
  const pendingUsers = users.value.filter((item) => selectedUserIds.value.includes(item.id) && item.status === 'PENDING')
  if (!pendingUsers.length) {
    ElMessage.warning('请选择待审核用户')
    return
  }

  selectedUserIds.value = pendingUsers.map((item) => item.id)
  await runBatchStatusUpdate('ACTIVE', '批量审核已完成')
}

const markSelectedUsersAsLeft = async () => {
  if (!canChangeUserStatus()) {
    return
  }
  const activeUsers = users.value.filter((item) => selectedUserIds.value.includes(item.id) && item.status === 'ACTIVE')
  if (!activeUsers.length) {
    ElMessage.warning('请选择在职用户')
    return
  }

  await ElMessageBox.confirm(`确认将选中的 ${activeUsers.length} 个用户标记为离职吗？`, '批量离职确认', {
    type: 'warning',
  })
  selectedUserIds.value = activeUsers.map((item) => item.id)
  await runBatchStatusUpdate('DISABLED', '批量离职已完成')
}

const markUserAsLeft = async (user: SystemUserItem) => {
  if (!canChangeUserStatus()) {
    return
  }
  await ElMessageBox.confirm(`确认将 ${user.realName} 标记为离职吗？`, '离职确认', {
    type: 'warning',
  })
  await updateUserStatus(user, 'DISABLED', '已标记为离职')
}

const restoreUser = async (user: SystemUserItem) => {
  if (!canChangeUserStatus()) {
    return
  }
  await updateUserStatus(user, 'ACTIVE', '已恢复为在职')
}

const removeUser = async (user: SystemUserItem) => {
  if (!canDeleteUsers()) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除账号“${user.realName}”吗？删除后不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
    })
    await deleteSystemUser(user.id)
    ElMessage.success('用户已删除')
    await loadUsers()
  } catch (error: any) {
    if (error === 'cancel') {
      return
    }
    ElMessage.error(error?.response?.data?.message || error?.message || '删除用户失败')
  }
}

const closeDialog = () => {
  selectedUserIds.value = []
  dialogVisible.value = false
  resetForm()
}

const submit = async () => {
  saving.value = true
  try {
    const selectedDepartment = departmentOptions.value.find((item) => item.id === form.departmentId)
    const payload: SystemUserPayload = {
      realName: form.realName,
      phone: form.phone,
      department: selectedDepartment?.plainName || '',
      departmentId: form.departmentId,
      roleId: form.roleId,
      status: form.status,
      ...(form.password ? { password: form.password } : {}),
    }

    if (editingUserId.value) {
      await updateSystemUser(editingUserId.value, payload)
      ElMessage.success('用户信息已更新')
    } else {
      await createSystemUser(payload)
      ElMessage.success('用户已创建')
    }
    closeDialog()
    await loadUsers()
  } finally {
    saving.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>用户管理 / 权限管理入口</template>

      <el-empty v-if="!canViewUsers()" description="当前账号无权查看用户管理" />

      <div v-else class="page-stack">
        <el-card shadow="never">
          <template #header>筛选条件</template>
          <el-form inline>
            <el-form-item label="关键词">
              <el-input v-model="keyword" placeholder="姓名 / 手机 / 部门" clearable />
            </el-form-item>
            <el-form-item label="角色">
              <el-select v-model="roleFilter" placeholder="全部角色" clearable style="width: 180px">
                <el-option v-for="item in roleOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px" @change="syncQuickStatusFilter">
                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="resetFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="list-header">
              <div class="list-header-left">
                <span>系统账号列表</span>
                <el-radio-group v-model="quickStatusFilter" @change="setQuickStatusFilter">
                  <el-radio-button label="ALL">全部</el-radio-button>
                  <el-radio-button label="ACTIVE">在职</el-radio-button>
                  <el-radio-button label="DISABLED">离职</el-radio-button>
                  <el-radio-button label="PENDING">待审核</el-radio-button>
                </el-radio-group>
              </div>
              <div class="list-header-actions">
                <el-button v-if="canChangeUserStatus()" :disabled="!selectedUserIds.length" type="success" @click="approveSelectedUsers">批量审核</el-button>
                <el-button v-if="canChangeUserStatus()" :disabled="!selectedUserIds.length" type="warning" @click="markSelectedUsersAsLeft">批量离职</el-button>
                <el-button v-if="canCreateUsers()" type="primary" @click="openCreateDialog">新增用户</el-button>
              </div>
            </div>
          </template>
          <el-table v-loading="loading" :data="paginatedUsers" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="50" />
            <el-table-column label="姓名" prop="realName" min-width="120" />
            <el-table-column label="手机号" prop="phone" min-width="130" />
            <el-table-column label="角色名称" prop="roleName" min-width="120" />
            <el-table-column label="部门" prop="department" min-width="140" />
            <el-table-column label="状态" min-width="100">
              <template #default="scope">
                {{ getStatusLabel(scope.row.status) }}
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="180">
              <template #default="scope">
                {{ scope.row.createdAt?.replace('T', ' ').slice(0, 19) || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="scope">
                <el-button v-if="canChangeUserStatus() && scope.row.status === 'PENDING'" link type="success" @click="approveUser(scope.row)">通过</el-button>
                <el-button v-if="canChangeUserStatus() && scope.row.status === 'PENDING'" link type="danger" @click="rejectUser(scope.row)">驳回</el-button>
                <el-tooltip v-if="canEditUsers()" content="编辑用户" placement="top">
                  <el-button link type="primary" :icon="Edit" @click="openEditDialog(scope.row)" />
                </el-tooltip>
                <el-button v-if="canChangeUserStatus() && scope.row.status === 'ACTIVE'" link type="warning" @click="markUserAsLeft(scope.row)">离职</el-button>
                <el-button v-if="canChangeUserStatus() && scope.row.status === 'DISABLED'" link type="success" @click="restoreUser(scope.row)">恢复在职</el-button>
                <el-tooltip v-if="canDeleteUsers()" content="删除用户" placement="top">
                  <el-button link type="danger" :icon="Delete" @click="removeUser(scope.row)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
          <div class="table-pagination">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="pageSizeOptions"
              :total="filteredUsers.length"
              layout="total, sizes, prev, pager, next, jumper"
              background
            />
          </div>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingUserId ? '编辑用户' : '新增用户'" width="640px">
      <el-form label-width="110px" class="form-grid">
        <el-form-item label="姓名">
          <el-input v-model="form.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password :placeholder="editingUserId ? '留空则不修改密码' : '请输入登录密码'" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.departmentId" placeholder="请选择部门" clearable>
            <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleId" placeholder="请选择角色">
            <el-option v-for="item in roles" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="待审核" value="PENDING" />
            <el-option label="在职" value="ACTIVE" />
            <el-option label="离职" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.list-header-left,
.list-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
</style>
