<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { authStorage } from '../../auth'
import { hasPermission } from '../../utils/permissions'
import { fetchMyTrafficStat, fetchTrafficStatDepartments, fetchTrafficStats, fetchTrafficStatsSummary, saveMyTrafficStat } from '../../api/traffic-stats'
import type { ReportDepartmentOption, ReportQueryParams, SaveTrafficStatPayload, TrafficStatItem, TrafficStatSummaryRow } from '../../types'

const canSubmit = computed(() => hasPermission('trafficStats.submit'))
const canView = computed(() => hasPermission('trafficStats.view'))

const loading = ref(false)
const saving = ref(false)
const records = ref<TrafficStatItem[]>([])
const summaryRows = ref<TrafficStatSummaryRow[]>([])
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
  receptionCount: 0,
})
const totals = reactive({
  transferCount: 0,
  receptionCount: 0,
  conversionRate: 0,
})

const currentUserName = computed(() => authStorage.getUser()?.realName || '-')
const currentDepartmentName = computed(() => authStorage.getUser()?.department || '-')
const formConversionRate = computed(() => {
  if (!form.transferCount) {
    return 0
  }
  return Number((form.receptionCount / form.transferCount).toFixed(4))
})
const formatPercent = (value: number) => `${(Number(value || 0) * 100).toFixed(2)}%`

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

const loadForm = async () => {
  if (!canSubmit.value) {
    return
  }

  const data = await fetchMyTrafficStat(form.reportDate)
  form.transferCount = data.transferCount
  form.receptionCount = data.receptionCount
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
    const [listResponse, summaryResponse] = await Promise.all([
      fetchTrafficStats(params),
      fetchTrafficStatsSummary(params),
    ])
    records.value = listResponse.rows
    summaryRows.value = summaryResponse.rows
    totals.transferCount = summaryResponse.totals.transferCount
    totals.receptionCount = summaryResponse.totals.receptionCount
    totals.conversionRate = summaryResponse.totals.conversionRate
  } finally {
    loading.value = false
  }
}

const submit = async () => {
  saving.value = true
  try {
    await saveMyTrafficStat({
      reportDate: form.reportDate,
      transferCount: Number(form.transferCount || 0),
      receptionCount: Number(form.receptionCount || 0),
    })
    ElMessage.success('来客接待统计已保存')
    await Promise.all([loadForm(), loadStats()])
  } finally {
    saving.value = false
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
    loadForm()
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

  await Promise.all([loadForm(), loadStats()])
})
</script>

<template>
  <div class="page-stack traffic-stats-view" v-loading="loading">
    <el-card>
      <template #header>来客接待统计</template>
      <el-alert title="员工按日期填写转入、接待数据，系统自动计算接待率，后续可继续扩展更多指标。" type="info" :closable="false" show-icon />
    </el-card>

    <el-card v-if="canSubmit" shadow="never">
      <template #header>我的日报填报</template>
      <div class="page-stack-sm">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">填报人</span>
            <span class="info-value">{{ currentUserName }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">所属部门</span>
            <span class="info-value">{{ currentDepartmentName }}</span>
          </div>
        </div>
        <el-form label-width="100px" class="form-grid">
          <el-form-item label="日期">
            <el-date-picker v-model="form.reportDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择日期" style="width: 100%" />
          </el-form-item>
          <el-form-item label="转入">
            <el-input v-model.number="form.transferCount" type="number" min="0" placeholder="请输入转入数量" />
          </el-form-item>
          <el-form-item label="接待">
            <el-input v-model.number="form.receptionCount" type="number" min="0" placeholder="请输入接待数量" />
          </el-form-item>
          <el-form-item label="接待率">
            <div class="static-text">{{ formatPercent(formConversionRate) }}</div>
          </el-form-item>
        </el-form>
        <div class="actions-row">
          <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
        </div>
      </div>
    </el-card>

    <template v-if="canView">
      <div class="stats-grid">
        <el-card shadow="never">
          <div class="stat-label">转入合计</div>
          <div class="stat-value">{{ totals.transferCount }}</div>
        </el-card>
        <el-card shadow="never">
          <div class="stat-label">接待合计</div>
          <div class="stat-value">{{ totals.receptionCount }}</div>
        </el-card>
        <el-card shadow="never">
          <div class="stat-label">平均接待率</div>
          <div class="stat-value primary">{{ formatPercent(totals.conversionRate) }}</div>
        </el-card>
      </div>

      <el-card shadow="never">
        <template #header>统计筛选</template>
        <el-form inline>
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
      </el-card>

      <el-card shadow="never">
        <template #header>按日期汇总</template>
        <el-table :data="summaryRows">
          <el-table-column prop="date" label="日期" min-width="140" />
          <el-table-column prop="transferCount" label="转入" min-width="120" />
          <el-table-column prop="receptionCount" label="接待" min-width="120" />
          <el-table-column label="接待率" min-width="140">
            <template #default="scope">
              {{ formatPercent(scope.row.conversionRate) }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card shadow="never">
        <template #header>明细列表</template>
        <el-table :data="records">
          <el-table-column prop="reportDate" label="日期" min-width="140" />
          <el-table-column prop="userName" label="填报人" min-width="140" />
          <el-table-column prop="departmentName" label="部门" min-width="180" />
          <el-table-column prop="transferCount" label="转入" min-width="120" />
          <el-table-column prop="receptionCount" label="接待" min-width="120" />
          <el-table-column label="接待率" min-width="140">
            <template #default="scope">
              {{ formatPercent(scope.row.conversionRate) }}
            </template>
          </el-table-column>
          <el-table-column label="更新时间" min-width="180">
            <template #default="scope">
              {{ scope.row.updatedAt?.replace('T', ' ').slice(0, 19) || '-' }}
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 8px 16px;
}

.static-text {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.stat-value.primary {
  color: var(--el-color-primary);
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}
</style>
