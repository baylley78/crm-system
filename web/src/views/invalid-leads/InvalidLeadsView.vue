<script setup lang="ts">
import * as XLSX from 'xlsx'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { fetchInvalidLeadDepartments, fetchInvalidLeads, saveInvalidLead } from '../../api/invalid-leads'
import type { InvalidLeadItem, ReportDepartmentOption, ReportQueryParams, SaveInvalidLeadPayload } from '../../types'
import { hasPermission } from '../../utils/permissions'

const canSubmit = computed(() => hasPermission('invalidLeads.submit'))
const canView = computed(() => hasPermission('invalidLeads.view'))

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const records = ref<InvalidLeadItem[]>([])
const departmentOptions = ref<ReportDepartmentOption[]>([])
const dateRange = ref<[Date, Date] | []>([])
const activeQuickRange = ref<'day' | 'week' | 'month' | ''>('')
const filters = reactive<ReportQueryParams>({
  startDate: '',
  endDate: '',
  departmentId: undefined,
})
const form = reactive<SaveInvalidLeadPayload>({
  reportDate: new Date().toISOString().slice(0, 10),
  phone: '',
})

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'

const syncDateRangeFilters = (start?: Date, end?: Date) => {
  dateRange.value = start && end ? [start, end] : []
  filters.startDate = start ? start.toISOString() : ''
  filters.endDate = end ? end.toISOString() : ''
}

const applyQuickRange = (range: 'day' | 'week' | 'month') => {
  activeQuickRange.value = range
  const end = new Date()
  const start = new Date(end)

  if (range === 'day') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  }

  if (range === 'week') {
    const day = end.getDay() || 7
    start.setDate(end.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  }

  if (range === 'month') {
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  }

  syncDateRangeFilters(start, end)
}

const buildQueryParams = (): ReportQueryParams => ({
  startDate: filters.startDate || undefined,
  endDate: filters.endDate || undefined,
  departmentId: filters.departmentId,
})

const loadDepartmentOptions = async () => {
  if (!canView.value) {
    return
  }
  const response = await fetchInvalidLeadDepartments()
  departmentOptions.value = response.options
}

const loadRows = async () => {
  if (!canView.value) {
    return
  }

  loading.value = true
  try {
    const response = await fetchInvalidLeads(buildQueryParams())
    records.value = response.rows
  } finally {
    loading.value = false
  }
}

const openDrawer = () => {
  form.reportDate = new Date().toISOString().slice(0, 10)
  form.phone = ''
  drawerVisible.value = true
}

const submit = async () => {
  if (!form.phone.trim()) {
    ElMessage.warning('请输入无效电话号码')
    return
  }

  saving.value = true
  try {
    await saveInvalidLead({
      reportDate: form.reportDate,
      phone: form.phone.trim(),
    })
    ElMessage.success('无效客资已提交')
    drawerVisible.value = false
    await loadRows()
  } catch (error: any) {
    ElMessage.error(error?.message || '提交无效客资失败')
  } finally {
    saving.value = false
  }
}

const resetFilters = async () => {
  filters.departmentId = undefined
  applyQuickRange('day')
  await loadRows()
}

const exportRows = async () => {
  if (!canView.value) {
    return
  }

  loading.value = true
  try {
    const response = await fetchInvalidLeads(buildQueryParams())
    if (!response.rows.length) {
      ElMessage.warning('当前筛选条件下没有可导出的无效客资')
      return
    }

    const sheetRows = response.rows.map((item) => ({
      提交日期: item.reportDate,
      无效电话号码: item.phone,
      提交销售: item.salesName || item.userName,
      部门: item.departmentName || '',
      提交时间: formatDateTime(item.createdAt),
    }))

    const worksheet = XLSX.utils.json_to_sheet(sheetRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '无效客资')
    XLSX.writeFile(workbook, '无效客资.xlsx')
  } finally {
    loading.value = false
  }
}

watch(dateRange, (value) => {
  filters.startDate = value[0] ? value[0].toISOString() : ''
  filters.endDate = value[1] ? value[1].toISOString() : ''
  activeQuickRange.value = ''
})

onMounted(async () => {
  if (canView.value) {
    await loadDepartmentOptions()
    applyQuickRange('day')
    await loadRows()
  }
})
</script>

<template>
  <div class="page-stack invalid-leads-view" v-loading="loading">
    <el-card shadow="never">
      <template #header>
        <div class="card-header-row">
          <span>无效客资</span>
          <el-button v-if="canSubmit" type="primary" @click="openDrawer">添加</el-button>
        </div>
      </template>
      <el-alert title="销售提交无效流量号码后，普通销售仅查看自己提交的数据；管理者按权限范围查看和导出。" type="info" :closable="false" show-icon />
    </el-card>

    <template v-if="canView">
      <el-card shadow="never">
        <template #header>筛选条件</template>
        <el-form inline class="filter-form">
          <el-form-item label="部门">
            <el-select v-model="filters.departmentId" clearable placeholder="全部部门" style="width: 240px">
              <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
          </el-form-item>
          <el-form-item label="快捷筛选">
            <el-space>
              <el-button :type="activeQuickRange === 'day' ? 'primary' : 'default'" @click="applyQuickRange('day')">日</el-button>
              <el-button :type="activeQuickRange === 'week' ? 'primary' : 'default'" @click="applyQuickRange('week')">周</el-button>
              <el-button :type="activeQuickRange === 'month' ? 'primary' : 'default'" @click="applyQuickRange('month')">月</el-button>
            </el-space>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadRows">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
            <el-button @click="exportRows">导出</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never">
        <template #header>明细列表</template>
        <el-table :data="records">
          <el-table-column prop="reportDate" label="提交日期" min-width="120" />
          <el-table-column prop="phone" label="无效电话号码" min-width="160" />
          <el-table-column prop="salesName" label="提交销售" min-width="140" />
          <el-table-column prop="departmentName" label="部门" min-width="180" />
          <el-table-column label="提交时间" min-width="180">
            <template #default="scope">
              {{ formatDateTime(scope.row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <el-drawer v-model="drawerVisible" title="添加无效客资" size="420px">
      <div class="page-stack-sm">
        <el-form label-width="100px">
          <el-form-item label="日期">
            <el-date-picker v-model="form.reportDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择日期" style="width: 100%" />
          </el-form-item>
          <el-form-item label="电话号码">
            <el-input v-model.trim="form.phone" placeholder="请输入无效电话号码" maxlength="11" clearable />
          </el-form-item>
        </el-form>
        <div class="drawer-actions">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
