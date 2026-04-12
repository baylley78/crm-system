<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { hasPermission } from '../../utils/permissions'
import { batchDeleteTrafficStats, deleteTrafficStat, fetchMyTrafficStat, fetchTrafficStatDepartments, fetchTrafficStats, saveMyTrafficStat } from '../../api/traffic-stats'
import type { ReportDepartmentOption, ReportQueryParams, SaveTrafficStatPayload, TrafficStatDailyForm, TrafficStatItem } from '../../types'

const canSubmit = computed(() => hasPermission('trafficStats.submit'))
const canView = computed(() => hasPermission('trafficStats.view'))
const canDelete = computed(() => hasPermission('trafficStats.delete'))

const loading = ref(false)
const saving = ref(false)
const drawerVisible = ref(false)
const records = ref<TrafficStatItem[]>([])
const selectedRecordIds = ref<number[]>([])
const departmentOptions = ref<ReportDepartmentOption[]>([])
const dateRange = ref<[Date, Date] | []>([])
const filters = reactive<ReportQueryParams>({
  startDate: '',
  endDate: '',
  departmentId: undefined,
})
const form = reactive<SaveTrafficStatPayload>({
  reportDate: new Date().toISOString().slice(0, 10),
  transferCount: 0,
  addCount: 0,
})
const crmFormStats = reactive<Omit<TrafficStatDailyForm, 'reportDate' | 'salesName' | 'firstSalesTeamName' | 'firstSalesDepartmentName' | 'transferCount' | 'addCount'>>({
  depositCount: 0,
  tailCount: 0,
  fullCount: 0,
  timelyCount: 0,
  totalPerformance: 0,
  depositConversionRate: 0,
  conversionRate: 0,
  lossRate: 0,
})
const formSalesName = ref('-')
const formFirstSalesTeamName = ref('-')
const formFirstSalesDepartmentName = ref('-')

const formTeamDepartmentText = computed(() => `${formFirstSalesTeamName.value || '-'} / ${formFirstSalesDepartmentName.value || '-'}`)
const formatPercent = (value: number) => `${(Number(value || 0) * 100).toFixed(2)}%`
const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const formatPerformance = (value: number) => Number(value || 0).toFixed(2)

const applyQuickRange = (range: 'day' | 'week' | 'month') => {
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
  dateRange.value = [start, end]
}

const applyFormData = (data: TrafficStatDailyForm) => {
  formSalesName.value = data.salesName || '-'
  formFirstSalesTeamName.value = data.firstSalesTeamName || '-'
  formFirstSalesDepartmentName.value = data.firstSalesDepartmentName || '-'
  form.transferCount = data.transferCount
  form.addCount = data.addCount
  crmFormStats.depositCount = data.depositCount
  crmFormStats.tailCount = data.tailCount
  crmFormStats.fullCount = data.fullCount
  crmFormStats.timelyCount = data.timelyCount
  crmFormStats.totalPerformance = Number(data.totalPerformance || 0)
  crmFormStats.depositConversionRate = data.depositConversionRate
  crmFormStats.conversionRate = data.conversionRate
  crmFormStats.lossRate = data.lossRate
}

const loadForm = async () => {
  if (!canSubmit.value) {
    return
  }

  try {
    const data = await fetchMyTrafficStat(form.reportDate)
    applyFormData(data)
  } catch (error: any) {
    ElMessage.error(error?.message || '加载来客统计失败')
  }
}

const openDrawer = async () => {
  drawerVisible.value = true
  await loadForm()
}

const loadDepartmentOptions = async () => {
  if (!canView.value) {
    return
  }
  const response = await fetchTrafficStatDepartments()
  departmentOptions.value = response.options
}

const loadStats = async () => {
  if (!canView.value) {
    return
  }

  loading.value = true
  try {
    const params: ReportQueryParams = {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      departmentId: filters.departmentId,
    }
    const listResponse = await fetchTrafficStats(params)
    records.value = listResponse.rows
  } finally {
    loading.value = false
  }
}

const submit = async () => {
  saving.value = true
  try {
    const data = await saveMyTrafficStat({
      reportDate: form.reportDate,
      transferCount: Number(form.transferCount || 0),
      addCount: Number(form.addCount || 0),
    })
    ElMessage.success('来客统计已保存')
    applyFormData(data)
    drawerVisible.value = false
    await loadStats()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存来客统计失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (item: TrafficStatItem) => {
  await ElMessageBox.confirm(`确认删除 ${item.salesName || '该销售'} 在 ${item.reportDate} 的来客统计吗？删除后可重新填报。`, '删除来客统计', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  loading.value = true
  try {
    await deleteTrafficStat(item.id)
    ElMessage.success('来客统计已删除')
    selectedRecordIds.value = []
    await loadStats()
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (rows: TrafficStatItem[]) => {
  selectedRecordIds.value = rows.map((item) => item.id)
}

const handleBatchDelete = async () => {
  if (!selectedRecordIds.value.length) {
    ElMessage.warning('请先选择来客统计')
    return
  }

  await ElMessageBox.confirm(`确认批量删除已选 ${selectedRecordIds.value.length} 条来客统计吗？删除后可重新填报。`, '批量删除来客统计', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  loading.value = true
  try {
    await batchDeleteTrafficStats(selectedRecordIds.value)
    ElMessage.success('批量删除来客统计成功')
    selectedRecordIds.value = []
    await loadStats()
  } finally {
    loading.value = false
  }
}

const resetFilters = async () => {
  filters.departmentId = undefined
  applyQuickRange('day')
  await loadStats()
}

watch(
  () => form.reportDate,
  () => {
    if (drawerVisible.value) {
      loadForm()
    }
  },
)

watch(dateRange, (value) => {
  filters.startDate = value[0] ? value[0].toISOString() : ''
  filters.endDate = value[1] ? value[1].toISOString() : ''
})

onMounted(async () => {
  if (canView.value) {
    await loadDepartmentOptions()
    applyQuickRange('day')
  }

  await loadStats()
})
</script>

<template>
  <div class="page-stack traffic-stats-view" v-loading="loading">
    <template v-if="canView">
      <el-card shadow="never">
        <template #header>
          <div class="card-header-row">
            <span>明细列表</span>
            <el-space>
              <el-button v-if="canDelete" type="danger" :loading="loading" @click="handleBatchDelete">批量删除</el-button>
              <el-button v-if="canSubmit" type="primary" @click="openDrawer">添加</el-button>
            </el-space>
          </div>
        </template>
        <div class="page-stack-sm">
          <el-form inline class="filter-form">
            <el-form-item label="部门">
              <el-select v-model="filters.departmentId" clearable placeholder="全部部门" style="width: 240px">
                <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="时间范围">
              <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
            </el-form-item>
            <el-form-item>
              <el-button @click="applyQuickRange('day')">日</el-button>
              <el-button @click="applyQuickRange('week')">周</el-button>
              <el-button @click="applyQuickRange('month')">月</el-button>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadStats">查询</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table :data="records" @selection-change="handleSelectionChange">
            <el-table-column v-if="canDelete" type="selection" width="55" />
            <el-table-column prop="reportDate" label="日期" min-width="120" />
            <el-table-column prop="salesName" label="填报销售" min-width="140" />
            <el-table-column label="一销团队/部门" min-width="220">
              <template #default="scope">
                {{ scope.row.firstSalesTeamName || '-' }} / {{ scope.row.firstSalesDepartmentName || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="transferCount" label="转入" min-width="100" />
            <el-table-column prop="addCount" label="添加" min-width="100" />
            <el-table-column prop="depositCount" label="定金" min-width="100" />
            <el-table-column prop="tailCount" label="尾款" min-width="100" />
            <el-table-column prop="fullCount" label="全款" min-width="100" />
            <el-table-column prop="timelyCount" label="及时" min-width="100" />
            <el-table-column label="定金转化率" min-width="120">
              <template #default="scope">
                {{ formatPercent(scope.row.depositConversionRate) }}
              </template>
            </el-table-column>
            <el-table-column label="转化率" min-width="120">
              <template #default="scope">
                {{ formatPercent(scope.row.conversionRate) }}
              </template>
            </el-table-column>
            <el-table-column label="流失率" min-width="120">
              <template #default="scope">
                {{ formatPercent(scope.row.lossRate) }}
              </template>
            </el-table-column>
            <el-table-column label="总业绩" min-width="120">
              <template #default="scope">
                {{ formatPerformance(scope.row.totalPerformance) }}
              </template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column v-if="canDelete" label="操作" fixed="right" width="80">
              <template #default="scope">
                <el-tooltip content="删除来客统计" placement="top">
                  <el-button link type="danger" :icon="Delete" @click="handleDelete(scope.row)" />
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </template>

    <el-drawer v-model="drawerVisible" title="添加来客统计" size="520px">
      <div class="page-stack-sm">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">填报销售</span>
            <span class="info-value">{{ formSalesName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">一销团队/部门</span>
            <span class="info-value">{{ formTeamDepartmentText }}</span>
          </div>
        </div>
        <el-form label-width="100px" class="drawer-form">
          <el-form-item label="日期">
            <el-date-picker v-model="form.reportDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择日期" style="width: 100%" />
          </el-form-item>
          <el-form-item label="转入">
            <el-input v-model.number="form.transferCount" type="number" min="0" placeholder="请输入转入数量" />
          </el-form-item>
          <el-form-item label="添加">
            <el-input v-model.number="form.addCount" type="number" min="0" placeholder="请输入添加数量" />
          </el-form-item>
          <el-form-item label="定金">
            <div class="static-text">{{ crmFormStats.depositCount }}</div>
          </el-form-item>
          <el-form-item label="尾款">
            <div class="static-text">{{ crmFormStats.tailCount }}</div>
          </el-form-item>
          <el-form-item label="全款">
            <div class="static-text">{{ crmFormStats.fullCount }}</div>
          </el-form-item>
          <el-form-item label="及时">
            <div class="static-text">{{ crmFormStats.timelyCount }}</div>
          </el-form-item>
          <el-form-item label="总业绩">
            <div class="static-text">{{ formatPerformance(crmFormStats.totalPerformance) }}</div>
          </el-form-item>
          <el-form-item label="定金转化率">
            <div class="static-text">{{ formatPercent(crmFormStats.depositConversionRate) }}</div>
          </el-form-item>
          <el-form-item label="转化率">
            <div class="static-text">{{ formatPercent(crmFormStats.conversionRate) }}</div>
          </el-form-item>
          <el-form-item label="流失率">
            <div class="static-text">{{ formatPercent(crmFormStats.lossRate) }}</div>
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

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.info-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.drawer-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px 16px;
}

.static-text {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
