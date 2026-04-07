<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { assignUsersToRole, fetchRoleUsers, fetchRoles } from '../../api/auth'
import type { RoleOption, SystemUserItem } from '../../types'

const loading = ref(false)
const assigning = ref(false)
const roles = ref<RoleOption[]>([])
const selectedRoleId = ref<number | null>(null)
const assignedUsers = ref<SystemUserItem[]>([])
const availableUsers = ref<SystemUserItem[]>([])
const assignedSelectedIds = ref<number[]>([])
const availableSelectedIds = ref<number[]>([])
const assignedKeyword = ref('')
const availableKeyword = ref('')
const roleKeyword = ref('')

const selectedRole = computed(() => roles.value.find((item) => item.id === selectedRoleId.value) || null)

const filteredRoles = computed(() => {
  const keyword = roleKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return roles.value
  }

  return roles.value.filter((item) => [item.name, item.code, item.description].filter(Boolean).some((field) => String(field).toLowerCase().includes(keyword)))
})

const filterUsers = (list: SystemUserItem[], keyword: string) => {
  const value = keyword.trim().toLowerCase()
  if (!value) {
    return list
  }

  return list.filter((item) => {
    return [item.realName, item.phone, item.department, item.roleName]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(value))
  })
}

const filteredAssignedUsers = computed(() => filterUsers(assignedUsers.value, assignedKeyword.value))
const filteredAvailableUsers = computed(() => filterUsers(availableUsers.value, availableKeyword.value))

const handleAssignedSelectionChange = (rows: SystemUserItem[]) => {
  assignedSelectedIds.value = rows.map((item) => item.id)
}

const handleAvailableSelectionChange = (rows: SystemUserItem[]) => {
  availableSelectedIds.value = rows.map((item) => item.id)
}

const loadRoleUsers = async (roleId: number) => {
  const data = await fetchRoleUsers(roleId)
  assignedUsers.value = data.assignedUsers
  availableUsers.value = data.availableUsers
  assignedSelectedIds.value = []
  availableSelectedIds.value = []
}

const loadData = async () => {
  loading.value = true
  try {
    const roleList = await fetchRoles()
    roles.value = roleList
    const nextRole = selectedRoleId.value ? roleList.find((item) => item.id === selectedRoleId.value) : roleList[0]
    if (nextRole) {
      selectedRoleId.value = nextRole.id
      await loadRoleUsers(nextRole.id)
    } else {
      selectedRoleId.value = null
      assignedUsers.value = []
      availableUsers.value = []
    }
  } finally {
    loading.value = false
  }
}

const selectRole = async (role: RoleOption) => {
  selectedRoleId.value = role.id
  await loadRoleUsers(role.id)
}

const assignSelectedUsers = async () => {
  if (!selectedRole.value || !availableSelectedIds.value.length) {
    ElMessage.warning('请先选择待分配人员')
    return
  }

  assigning.value = true
  try {
    const data = await assignUsersToRole(selectedRole.value.id, { userIds: availableSelectedIds.value })
    assignedUsers.value = data.assignedUsers
    availableUsers.value = data.availableUsers
    assignedSelectedIds.value = []
    availableSelectedIds.value = []
    ElMessage.success('所选人员已分配到当前权限组')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || '分配失败')
  } finally {
    assigning.value = false
  }
}

const removeSelectedUsers = async () => {
  if (!selectedRole.value || !assignedSelectedIds.value.length) {
    ElMessage.warning('请先选择已分配人员')
    return
  }

  assigning.value = true
  try {
    const data = await assignUsersToRole(selectedRole.value.id, {
      userIds: assignedSelectedIds.value,
      removeToFirstSales: true,
    })
    assignedUsers.value = data.assignedUsers
    availableUsers.value = data.availableUsers
    assignedSelectedIds.value = []
    availableSelectedIds.value = []
    ElMessage.success('所选人员已移出当前权限组')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || '移除失败')
  } finally {
    assigning.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-stack role-assignment-view" v-loading="loading">
    <el-card>
      <template #header>
        <div class="page-header-row">
          <div>
            <div class="page-title">权限组人员分配</div>
            <div class="muted-text">仅用于把人员加入或移出已有权限组，不涉及权限定义修改</div>
          </div>
        </div>
      </template>

      <div class="assignment-layout">
        <el-card shadow="never" class="role-list-card">
          <template #header>
            <div class="panel-header-stack">
              <span>权限组列表</span>
              <el-input v-model="roleKeyword" placeholder="搜索权限组名称/编码" clearable />
            </div>
          </template>

          <div class="role-list">
            <button
              v-for="role in filteredRoles"
              :key="role.id"
              type="button"
              class="role-list-item"
              :class="{ active: role.id === selectedRoleId }"
              @click="selectRole(role)"
            >
              <div class="role-list-top">
                <span class="role-name">{{ role.name }}</span>
                <el-tag v-if="role.isSystem" size="small" type="info">内置</el-tag>
              </div>
              <div class="role-code">{{ role.code }}</div>
              <div class="role-meta muted-text">成员 {{ role.userCount || 0 }} 人</div>
            </button>
          </div>
        </el-card>

        <div class="main-stack" v-if="selectedRole">
          <el-card shadow="never" class="assignment-card">
            <template #header>
              <div class="detail-header">
                <div>
                  <div class="page-title-sm">{{ selectedRole.name }}</div>
                  <div class="muted-text">{{ selectedRole.description || '未填写说明' }}</div>
                </div>
              </div>
            </template>

            <div class="user-panels">
              <el-card shadow="never">
                <template #header>已分配人员</template>
                <div class="page-stack-sm">
                  <div class="toolbar-row">
                    <el-input v-model="assignedKeyword" placeholder="搜索账号/姓名/手机号/部门" clearable />
                    <el-button type="danger" :loading="assigning" @click="removeSelectedUsers">移出当前权限组</el-button>
                  </div>
                  <el-alert
                    title="从当前权限组移除后，人员会进入待分配人员列表，不会修改权限定义"
                    type="warning"
                    :closable="false"
                    show-icon
                  />
                  <el-table height="420" :data="filteredAssignedUsers" @selection-change="handleAssignedSelectionChange">
                    <el-table-column type="selection" width="50" />
                    <el-table-column prop="username" label="账号" min-width="120" />
                    <el-table-column prop="realName" label="姓名" min-width="120" />
                    <el-table-column prop="department" label="部门" min-width="140" />
                    <el-table-column prop="roleName" label="当前角色" min-width="120" />
                  </el-table>
                  <div class="panel-footer muted-text">当前权限组成员 {{ filteredAssignedUsers.length }} 人</div>
                </div>
              </el-card>

              <el-card shadow="never">
                <template #header>待分配人员</template>
                <div class="page-stack-sm">
                  <div class="toolbar-row">
                    <el-input v-model="availableKeyword" placeholder="搜索账号/姓名/手机号/部门" clearable />
                    <el-button type="success" :loading="assigning" @click="assignSelectedUsers">加入当前权限组</el-button>
                  </div>
                  <el-table height="420" :data="filteredAvailableUsers" @selection-change="handleAvailableSelectionChange">
                    <el-table-column type="selection" width="50" />
                    <el-table-column prop="username" label="账号" min-width="120" />
                    <el-table-column prop="realName" label="姓名" min-width="120" />
                    <el-table-column prop="department" label="部门" min-width="140" />
                    <el-table-column prop="roleName" label="当前角色" min-width="120" />
                  </el-table>
                  <div class="panel-footer muted-text">可分配人员 {{ filteredAvailableUsers.length }} 人</div>
                </div>
              </el-card>
            </div>
          </el-card>
        </div>

        <el-empty v-else description="请先选择权限组" />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.role-assignment-view {
  min-height: 100%;
}

.page-header-row,
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
}

.page-title-sm {
  font-size: 16px;
  font-weight: 700;
}

.assignment-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.role-list-card {
  position: sticky;
  top: 0;
}

.panel-header-stack {
  display: grid;
  gap: 12px;
}

.role-list {
  display: grid;
  gap: 12px;
  max-height: 840px;
  overflow: auto;
}

.role-list-item {
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  padding: 14px;
  text-align: left;
  background: var(--el-bg-color);
  cursor: pointer;
}

.role-list-item.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-5);
}

.role-list-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.main-stack {
  display: grid;
  gap: 16px;
}

.assignment-card {
  min-height: 560px;
}

.user-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.toolbar-row {
  display: flex;
  gap: 12px;
}

.panel-footer {
  text-align: right;
}

.role-name {
  font-weight: 600;
}

.role-code,
.muted-text,
.role-meta {
  color: var(--el-text-color-secondary);
}

.role-code {
  font-size: 12px;
  margin-top: 6px;
}

.role-meta {
  font-size: 12px;
  margin-top: 8px;
}

@media (max-width: 1400px) {
  .assignment-layout {
    grid-template-columns: 1fr;
  }

  .role-list-card {
    position: static;
  }

  .user-panels {
    grid-template-columns: 1fr;
  }
}
</style>
