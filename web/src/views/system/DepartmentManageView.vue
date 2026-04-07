<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { fetchSystemUsers } from '../../api/auth'
import { createDepartment, deleteDepartment, fetchDepartmentTree, updateDepartment } from '../../api/departments'
import { hasPermission } from '../../utils/permissions'
import type { DepartmentTreeItem, SystemUserItem } from '../../types'

const canViewDepartments = () => hasPermission('system.departments.view')
const canCreateDepartments = () => hasPermission('system.departments.create')
const canEditDepartments = () => hasPermission('system.departments.edit')
const canDeleteDepartments = () => hasPermission('system.departments.delete')

const loading = ref(false)
const treeData = ref<DepartmentTreeItem[]>([])
const users = ref<SystemUserItem[]>([])
const activeDepartmentId = ref<number | null>(null)
const form = reactive({
  name: '',
  leaderUserId: undefined as number | undefined,
  hrUserId: undefined as number | undefined,
})

const userOptions = computed(() => users.value.map((item) => ({ label: `${item.realName}（${item.roleName}）`, value: item.id })))

const findDepartment = (nodes: DepartmentTreeItem[], id: number): DepartmentTreeItem | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node
    }
    if (node.children?.length) {
      const target = findDepartment(node.children, id)
      if (target) {
        return target
      }
    }
  }
  return null
}

const findParentDepartment = (nodes: DepartmentTreeItem[], id: number, parent: DepartmentTreeItem | null = null): DepartmentTreeItem | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return parent
    }
    if (node.children?.length) {
      const target = findParentDepartment(node.children, id, node)
      if (target !== null) {
        return target
      }
    }
  }
  return null
}

const activeDepartment = computed(() => (activeDepartmentId.value ? findDepartment(treeData.value, activeDepartmentId.value) : null))
const totalDepartments = computed(() => {
  const countNodes = (nodes: DepartmentTreeItem[]): number => nodes.reduce((count, node) => count + 1 + countNodes(node.children || []), 0)
  return countNodes(treeData.value)
})
const rootDepartments = computed(() => treeData.value.length)

const selectDepartment = (node: DepartmentTreeItem) => {
  activeDepartmentId.value = node.id
  form.name = node.name
  form.leaderUserId = node.leaderUserId
  form.hrUserId = node.hrUserId
}

const loadDepartments = async () => {
  if (!canViewDepartments()) {
    treeData.value = []
    users.value = []
    activeDepartmentId.value = null
    return
  }

  loading.value = true
  try {
    const [departmentTree, userList] = await Promise.all([fetchDepartmentTree(), fetchSystemUsers()])
    treeData.value = departmentTree
    users.value = userList
    if (activeDepartmentId.value) {
      const next = findDepartment(treeData.value, activeDepartmentId.value)
      if (next) {
        form.name = next.name
        form.leaderUserId = next.leaderUserId
        form.hrUserId = next.hrUserId
        return
      }
    }
    if (treeData.value[0]) {
      selectDepartment(treeData.value[0])
    } else {
      activeDepartmentId.value = null
      form.name = ''
      form.leaderUserId = undefined
      form.hrUserId = undefined
    }
  } finally {
    loading.value = false
  }
}

const addChildDepartment = async () => {
  if (!canCreateDepartments()) {
    return
  }
  const current = activeDepartment.value
  if (!current) {
    ElMessage.warning('请先选择一个部门')
    return
  }
  await createDepartment({ name: '新部门', parentId: current.id })
  ElMessage.success('已新增下级部门')
  await loadDepartments()
}

const addSiblingDepartment = async () => {
  if (!canCreateDepartments()) {
    return
  }
  const current = activeDepartment.value
  if (!current) {
    ElMessage.warning('请先选择一个部门')
    return
  }
  const parent = findParentDepartment(treeData.value, current.id)
  await createDepartment({ name: '新部门', parentId: parent?.id })
  ElMessage.success('已新增同级部门')
  await loadDepartments()
}

const saveDepartment = async () => {
  if (!canEditDepartments()) {
    return
  }
  const current = activeDepartment.value
  if (!current) {
    ElMessage.warning('请先选择一个部门')
    return
  }
  const nextName = form.name.trim()
  if (!nextName) {
    ElMessage.warning('部门名称不能为空')
    return
  }
  await updateDepartment(current.id, {
    name: nextName,
    parentId: current.parentId,
    sort: current.sort,
    leaderUserId: form.leaderUserId,
    hrUserId: form.hrUserId,
  })
  ElMessage.success('部门信息已更新')
  await loadDepartments()
}

const removeDepartmentNode = async () => {
  if (!canDeleteDepartments()) {
    return
  }
  const current = activeDepartment.value
  if (!current) {
    ElMessage.warning('请先选择一个部门')
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除部门“${current.name}”吗？`, '删除部门', { type: 'warning' })
    await deleteDepartment(current.id)
    ElMessage.success('部门已删除')
    await loadDepartments()
  } catch (error: any) {
    if (error === 'cancel') {
      return
    }
    ElMessage.error(error?.response?.data?.message || error?.message || '删除部门失败')
  }
}

onMounted(loadDepartments)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>部门管理 / 部门树设置</template>

      <el-empty v-if="!canViewDepartments()" description="当前账号无权查看部门管理" />

      <div v-else class="page-stack">
        <div class="stats-grid">
          <el-card shadow="never">
            <div class="stat-label">部门总数</div>
            <div class="stat-value">{{ totalDepartments }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">顶级部门</div>
            <div class="stat-value">{{ rootDepartments }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">当前选中</div>
            <div class="stat-value">{{ activeDepartment?.name || '未选择' }}</div>
          </el-card>
        </div>

        <div class="department-layout">
          <el-card shadow="never" v-loading="loading">
            <template #header>
              <div class="toolbar-row">
                <span>部门树</span>
                <el-button v-if="canCreateDepartments()" type="primary" @click="addSiblingDepartment">新增顶级部门</el-button>
              </div>
            </template>
            <el-tree :data="treeData" node-key="id" default-expand-all highlight-current @node-click="selectDepartment">
              <template #default="{ data }">
                <div class="tree-node-inline">
                  <span class="tree-node-name">{{ data.name }}</span>
                  <span v-if="data.leaderName" class="tree-node-inline-meta">负责人：{{ data.leaderName }}</span>
                  <span v-if="data.hrName" class="tree-node-inline-meta">人事：{{ data.hrName }}</span>
                </div>
              </template>
            </el-tree>
          </el-card>

          <el-card shadow="never">
            <template #header>部门信息</template>
            <el-form label-width="100px" class="page-stack">
              <el-form-item label="当前部门">
                <el-input v-model="form.name" :disabled="!canEditDepartments()" placeholder="请输入部门名称" />
              </el-form-item>
              <el-form-item label="部门负责人">
                <el-select v-model="form.leaderUserId" :disabled="!canEditDepartments()" placeholder="请选择负责人" clearable filterable style="width: 100%">
                  <el-option v-for="item in userOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="人事">
                <el-select v-model="form.hrUserId" :disabled="!canEditDepartments()" placeholder="请选择人事" clearable filterable style="width: 100%">
                  <el-option v-for="item in userOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item>
                <el-space wrap>
                  <el-button v-if="canEditDepartments()" type="primary" @click="saveDepartment">保存部门</el-button>
                  <el-button v-if="canCreateDepartments()" @click="addChildDepartment">新增下级</el-button>
                  <el-button v-if="canCreateDepartments()" @click="addSiblingDepartment">新增同级</el-button>
                  <el-button v-if="canDeleteDepartments()" type="danger" plain @click="removeDepartmentNode">删除部门</el-button>
                </el-space>
              </el-form-item>
              <el-alert title="为部门设置人事后，该人事账号可管理该部门及下级部门的人员信息。" type="success" :closable="false" show-icon />
            </el-form>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.department-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tree-node-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tree-node-name {
  font-weight: 500;
}

.tree-node-inline-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
