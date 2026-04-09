<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  copyRole,
  createRole,
  deleteRole,
  fetchPermissions,
  fetchRoles,
  syncBuiltInRolePermissions,
  updateRoleMeta,
  updateRolePermissions,
} from '../../api/auth'
import { hasPermission } from '../../utils/permissions'
import type {
  CopyRolePayload,
  CreateRolePayload,
  DataScope,
  PermissionItem,
  RoleOption,
  UpdateRoleMetaPayload,
} from '../../types'

const loading = ref(false)
const saving = ref(false)
const roleSubmitting = ref(false)
const roleDialogVisible = ref(false)
const roleDialogMode = ref<'create' | 'edit' | 'copy'>('create')
const roles = ref<RoleOption[]>([])
const permissions = ref<PermissionItem[]>([])
const selectedRoleId = ref<number | null>(null)
const selectedPermissionIds = ref<number[]>([])
const customerScope = ref<DataScope>('DEPARTMENT')
const reportScope = ref<DataScope>('DEPARTMENT')
const userManageScope = ref<DataScope>('SELF')
const roleKeyword = ref('')

const canCreateRoles = () => hasPermission('system.roles.create')
const canEditRoles = () => hasPermission('system.roles.edit')
const canDeleteRoles = () => hasPermission('system.roles.delete')

const handleSyncBuiltInRoles = async () => {
  if (!canEditRoles()) {
    return
  }

  saving.value = true
  try {
    const result = await syncBuiltInRolePermissions()
    ElMessage.success(`已同步 ${result.count} 个内置权限组，请重新登录使新权限生效`)
    await loadData()
  } finally {
    saving.value = false
  }
}

const roleForm = reactive<CreateRolePayload>({
  name: '',
  code: '',
  description: '',
  customerScope: 'DEPARTMENT',
  reportScope: 'DEPARTMENT',
  userManageScope: 'SELF',
  permissionIds: [],
})

const scopeOptions: Array<{ label: string; value: DataScope }> = [
  { label: '本人', value: 'SELF' },
  { label: '本部门', value: 'DEPARTMENT' },
  { label: '本部门及下级', value: 'DEPARTMENT_AND_CHILDREN' },
  { label: '全部', value: 'ALL' },
]

const permissionGroupMeta: Record<string, string> = {
  dashboard: '首页',
  customers: '客户管理',
  contracts: '合同档案',
  firstSales: '一销业绩',
  secondSales: '二销管理',
  thirdSales: '三销管理',
  reports: '业绩报表',
  legal: '法务系统',
  mediation: '调解系统',
  quality: '质检管理',
  oa: 'OA审批',
  system: '系统管理',
}

const permissionActionOrder = [
  'view',
  'customers.view',
  'users.view',
  'orders.view',
  'responsibles.view',
  'assignment.view',
  'reception.view',
  'create',
  'edit',
  'delete',
  'status',
  'follow',
  'phone.unmask',
  'phone.unmask.self',
  'review.single',
  'review.batch',
  'assign',
  'transfer',
  'tail',
  'complete',
  'firstSales.view',
  'firstSales.teamView',
  'secondSales.view',
  'secondSales.assignment.view',
  'secondSales.orders.view',
  'secondSales.teamView',
  'thirdSales.view',
  'thirdSales.reception.view',
  'thirdSales.orders.view',
  'thirdSales.teamView',
  'teamView',
  'export',
  'manage',
  'pay',
]

const groupedPermissions = computed(() => {
  const groupMap = new Map<string, { key: string; name: string; items: PermissionItem[] }>()

  permissions.value.forEach((permission) => {
    const groupKey = permission.code.split('.')[0] || 'other'
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        key: groupKey,
        name: permissionGroupMeta[groupKey] || groupKey,
        items: [],
      })
    }
    groupMap.get(groupKey)!.items.push(permission)
  })

  return Array.from(groupMap.values()).map((group) => ({
    ...group,
    items: group.items.sort((a, b) => {
      const actionA = a.code.split('.').slice(1).join('.')
      const actionB = b.code.split('.').slice(1).join('.')
      const indexA = permissionActionOrder.indexOf(actionA)
      const indexB = permissionActionOrder.indexOf(actionB)
      if (indexA !== indexB) {
        return (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) - (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB)
      }
      return a.id - b.id
    }),
  }))
})

const selectedRole = computed(() => roles.value.find((item) => item.id === selectedRoleId.value) || null)

const filteredRoles = computed(() => {
  const keyword = roleKeyword.value.trim().toLowerCase()
  if (!keyword) {
    return roles.value
  }

  return roles.value.filter((item) => [item.name, item.code, item.description].filter(Boolean).some((field) => String(field).toLowerCase().includes(keyword)))
})

const syncRoleState = (role: RoleOption) => {
  selectedRoleId.value = role.id
  selectedPermissionIds.value = role.permissions?.map((item) => item.id) || []
  customerScope.value = role.customerScope || 'DEPARTMENT'
  reportScope.value = role.reportScope || 'DEPARTMENT'
  userManageScope.value = role.userManageScope || 'SELF'
}

const resetRoleForm = () => {
  roleForm.name = ''
  roleForm.code = ''
  roleForm.description = ''
  roleForm.customerScope = 'DEPARTMENT'
  roleForm.reportScope = 'DEPARTMENT'
  roleForm.userManageScope = 'SELF'
  roleForm.permissionIds = []
}

const fillRoleForm = (role: RoleOption) => {
  roleForm.name = role.name
  roleForm.code = role.code
  roleForm.description = role.description || ''
  roleForm.customerScope = role.customerScope || 'DEPARTMENT'
  roleForm.reportScope = role.reportScope || 'DEPARTMENT'
  roleForm.userManageScope = role.userManageScope || 'SELF'
  roleForm.permissionIds = role.permissions?.map((item) => item.id) || []
}

const loadData = async () => {
  loading.value = true
  try {
    const [roleList, permissionList] = await Promise.all([fetchRoles(), fetchPermissions()])
    roles.value = roleList
    permissions.value = permissionList

    const nextRole = selectedRoleId.value ? roleList.find((item) => item.id === selectedRoleId.value) : roleList[0]
    if (nextRole) {
      syncRoleState(nextRole)
    } else {
      selectedRoleId.value = null
    }
  } finally {
    loading.value = false
  }
}

const selectRole = (role: RoleOption) => {
  syncRoleState(role)
}

const save = async () => {
  if (!selectedRole.value || !canEditRoles()) {
    return
  }

  saving.value = true
  try {
    await updateRolePermissions(selectedRole.value.id, {
      permissionIds: selectedPermissionIds.value,
      customerScope: customerScope.value,
      reportScope: reportScope.value,
      userManageScope: userManageScope.value,
    })
    ElMessage.success('权限组配置已保存')
    await loadData()
  } finally {
    saving.value = false
  }
}

const openCreateRoleDialog = () => {
  if (!canCreateRoles()) {
    return
  }
  roleDialogMode.value = 'create'
  resetRoleForm()
  roleDialogVisible.value = true
}

const openEditRoleDialog = () => {
  if (!selectedRole.value || !canEditRoles()) {
    return
  }
  roleDialogMode.value = 'edit'
  fillRoleForm(selectedRole.value)
  roleDialogVisible.value = true
}

const openCopyRoleDialog = () => {
  if (!selectedRole.value || !canCreateRoles()) {
    return
  }
  roleDialogMode.value = 'copy'
  fillRoleForm(selectedRole.value)
  roleForm.name = `${selectedRole.value.name}副本`
  roleForm.code = `${selectedRole.value.code}_COPY`
  roleDialogVisible.value = true
}

const submitRoleDialog = async () => {
  roleSubmitting.value = true
  try {
    if (roleDialogMode.value === 'create') {
      const created = await createRole(roleForm)
      ElMessage.success('权限组已创建')
      roleDialogVisible.value = false
      await loadData()
      selectRole(created)
      return
    }

    if (!selectedRole.value) {
      return
    }

    if (roleDialogMode.value === 'edit') {
      const updated = await updateRoleMeta(selectedRole.value.id, roleForm as UpdateRoleMetaPayload)
      ElMessage.success('权限组信息已更新')
      roleDialogVisible.value = false
      await loadData()
      selectRole(updated)
      return
    }

    const copied = await copyRole(selectedRole.value.id, roleForm as CopyRolePayload)
    ElMessage.success('权限组已复制')
    roleDialogVisible.value = false
    await loadData()
    selectRole(copied)
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || '操作失败')
  } finally {
    roleSubmitting.value = false
  }
}

const handleDeleteRole = async () => {
  if (!selectedRole.value || !canDeleteRoles()) {
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除权限组“${selectedRole.value.name}”吗？`, '删除权限组', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteRole(selectedRole.value.id)
    ElMessage.success('权限组已删除')
    selectedRoleId.value = null
    await loadData()
  } catch (error: any) {
    if (error === 'cancel') {
      return
    }
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || '删除失败')
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-stack role-permission-view" v-loading="loading">
    <el-card>
      <template #header>
        <div class="page-header-row">
          <div>
            <div class="page-title">权限组配置</div>
            <div class="muted-text">仅用于配置权限组基础信息、数据范围和权限项</div>
          </div>
          <div class="header-actions">
            <el-button v-if="canEditRoles()" :loading="saving" @click="handleSyncBuiltInRoles">同步内置角色权限</el-button>
            <el-button v-if="canCreateRoles()" type="primary" @click="openCreateRoleDialog">新增权限组</el-button>
          </div>
        </div>
      </template>

      <div class="permission-layout">
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
          <el-card shadow="never">
            <template #header>
              <div class="detail-header">
                <div>
                  <div class="page-title-sm">{{ selectedRole.name }}</div>
                  <div class="muted-text">{{ selectedRole.description || '未填写说明' }}</div>
                </div>
                <div class="detail-actions">
                  <el-button v-if="canEditRoles()" @click="openEditRoleDialog">编辑权限组</el-button>
                  <el-button v-if="canCreateRoles()" @click="openCopyRoleDialog">复制权限组</el-button>
                  <el-button v-if="canDeleteRoles()" type="danger" plain :disabled="selectedRole.isSystem" @click="handleDeleteRole">删除权限组</el-button>
                </div>
              </div>
            </template>

            <div class="page-stack">
              <el-form label-width="140px" class="scope-form">
                <el-form-item label="客户数据范围">
                  <el-radio-group v-model="customerScope" :disabled="!canEditRoles()">
                    <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="报表数据范围">
                  <el-radio-group v-model="reportScope" :disabled="!canEditRoles()">
                    <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="用户管理范围">
                  <el-radio-group v-model="userManageScope" :disabled="!canEditRoles()">
                    <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-form>

              <el-divider>菜单 / 功能权限</el-divider>

              <div class="permission-groups">
                <el-card v-for="group in groupedPermissions" :key="group.key" shadow="never" class="permission-group-card">
                  <template #header>
                    <div class="permission-group-header">
                      <span>{{ group.name }}</span>
                      <span class="muted-text">{{ group.items.length }} 项</span>
                    </div>
                  </template>
                  <el-checkbox-group v-model="selectedPermissionIds" class="permission-grid" :disabled="!canEditRoles()">
                    <el-checkbox v-for="permission in group.items" :key="permission.id" :value="permission.id">
                      {{ permission.name }}
                    </el-checkbox>
                  </el-checkbox-group>
                </el-card>
              </div>

              <div class="footer-actions">
                <el-button v-if="canEditRoles()" type="primary" :loading="saving" @click="save">保存权限组配置</el-button>
              </div>
            </div>
          </el-card>
        </div>

        <el-empty v-else description="请先创建或选择权限组" />
      </div>
    </el-card>

    <el-dialog
      v-model="roleDialogVisible"
      :title="roleDialogMode === 'create' ? '新增权限组' : roleDialogMode === 'edit' ? '编辑权限组' : '复制权限组'"
      width="560px"
    >
      <el-form label-width="110px" class="page-stack">
        <el-form-item label="权限组名称">
          <el-input v-model="roleForm.name" placeholder="请输入权限组名称" />
        </el-form-item>
        <el-form-item label="权限组编码">
          <el-input v-model="roleForm.code" placeholder="请输入大写编码，例如 SALES_MANAGER" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="roleForm.description" type="textarea" :rows="3" placeholder="请输入权限组说明" />
        </el-form-item>
        <el-form-item label="客户范围" v-if="roleDialogMode !== 'copy'">
          <el-radio-group v-model="roleForm.customerScope">
            <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="报表范围" v-if="roleDialogMode !== 'copy'">
          <el-radio-group v-model="roleForm.reportScope">
            <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="用户范围" v-if="roleDialogMode !== 'copy'">
          <el-radio-group v-model="roleForm.userManageScope">
            <el-radio v-for="item in scopeOptions" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="roleSubmitting" @click="submitRoleDialog">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.role-permission-view {
  min-height: 100%;
}

.page-header-row,
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
}

.page-title-sm {
  font-size: 16px;
  font-weight: 700;
}

.permission-layout {
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

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.scope-form :deep(.el-radio-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.permission-groups {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.permission-group-card {
  border: 1px solid var(--el-border-color-light);
}

.permission-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.permission-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
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
  .permission-layout {
    grid-template-columns: 1fr;
  }

  .role-list-card {
    position: static;
  }

  .permission-groups {
    grid-template-columns: 1fr;
  }
}
</style>
