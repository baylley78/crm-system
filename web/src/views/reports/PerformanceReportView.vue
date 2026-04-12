<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { hasPermission } from '../../utils/permissions'
import {
  fetchFirstSalesPersonal,
  fetchFirstSalesTeam,
  fetchReportDepartments,
  fetchSecondSalesPersonal,
  fetchSecondSalesTeam,
  fetchThirdSalesPersonal,
  fetchThirdSalesTeam,
} from '../../api/reports'
import type {
  FirstSalesPersonalRow,
  FirstSalesTeamRow,
  ReportDepartmentOption,
  ReportQueryParams,
  SecondSalesPersonalRow,
  SecondSalesTeamRow,
  ThirdSalesPersonalRow,
  ThirdSalesTeamRow,
} from '../../types'

const props = defineProps<{
  stage: 'first-sales' | 'second-sales' | 'third-sales'
  scope: 'personal' | 'team'
  title: string
}>()

const stagePermissionMap = {
  'first-sales': {
    personal: 'reports.firstSales.view',
    team: 'reports.firstSales.teamView',
  },
  'second-sales': {
    personal: 'reports.secondSales.view',
    team: 'reports.secondSales.teamView',
  },
  'third-sales': {
    personal: 'reports.thirdSales.view',
    team: 'reports.thirdSales.teamView',
  },
} as const

const canViewCurrentReport = computed(() => hasPermission(stagePermissionMap[props.stage][props.scope]))

type StageRowMap = {
  'first-sales': { personal: FirstSalesPersonalRow; team: FirstSalesTeamRow }
  'second-sales': { personal: SecondSalesPersonalRow; team: SecondSalesTeamRow }
  'third-sales': { personal: ThirdSalesPersonalRow; team: ThirdSalesTeamRow }
}

type CurrentRow = StageRowMap[typeof props.stage][typeof props.scope]

const loading = ref(false)
const filters = reactive<ReportQueryParams>({
  startDate: '',
  endDate: '',
  departmentId: undefined,
})
const dateRange = ref<[Date, Date] | []>([])
const rows = ref<CurrentRow[]>([])
const departmentOptions = ref<ReportDepartmentOption[]>([])
const activeQuickRange = ref<'day' | 'week' | 'month' | ''>('')

const fetcher = computed(() => {
  if (props.stage === 'first-sales' && props.scope === 'personal') return fetchFirstSalesPersonal
  if (props.stage === 'first-sales' && props.scope === 'team') return fetchFirstSalesTeam
  if (props.stage === 'second-sales' && props.scope === 'personal') return fetchSecondSalesPersonal
  if (props.stage === 'second-sales' && props.scope === 'team') return fetchSecondSalesTeam
  if (props.stage === 'third-sales' && props.scope === 'personal') return fetchThirdSalesPersonal
  return fetchThirdSalesTeam
})

const summaryTitle = computed(() => (props.scope === 'personal' ? '个人统计' : '团队统计'))

const columns = computed(() => {
  if (props.stage === 'first-sales' && props.scope === 'personal') {
    return [
      { key: 'userName', label: '人员名字' },
      { key: 'transferCount', label: '转入' },
      { key: 'addCount', label: '添加' },
      { key: 'timelyCount', label: '及时' },
      { key: 'depositCount', label: '定金成交' },
      { key: 'tailCount', label: '尾款成交' },
      { key: 'fullCount', label: '全款成交' },
      { key: 'depositAmount', label: '定金金额' },
      { key: 'tailAmount', label: '尾款金额' },
      { key: 'fullAmount', label: '全款金额' },
      { key: 'totalAmount', label: '总金额' },
      { key: 'avgAmount', label: '客单价' },
    ]
  }
  if (props.stage === 'first-sales' && props.scope === 'team') {
    return [
      { key: 'date', label: '日期' },
      { key: 'transferCount', label: '转入' },
      { key: 'addCount', label: '添加' },
      { key: 'timelyCount', label: '及时' },
      { key: 'depositCount', label: '定金成交' },
      { key: 'tailCount', label: '尾款成交' },
      { key: 'fullCount', label: '全款成交' },
      { key: 'depositAmount', label: '定金金额' },
      { key: 'tailAmount', label: '尾款金额' },
      { key: 'fullAmount', label: '全款金额' },
      { key: 'totalAmount', label: '总金额' },
      { key: 'avgAmount', label: '客单价' },
    ]
  }
  if (props.stage === 'second-sales' && props.scope === 'personal') {
    return [
      { key: 'userName', label: '人员名字' },
      { key: 'receptionCount', label: '接待' },
      { key: 'targetAmount', label: '标的金额' },
      { key: 'dealCount', label: '成交' },
      { key: 'dealAmount', label: '成交金额' },
      { key: 'conversionRate', label: '转化率', percent: true },
      { key: 'avgAmount', label: '客单价' },
      { key: 'unitQ', label: '单Q' },
    ]
  }
  if (props.stage === 'second-sales' && props.scope === 'team') {
    return [
      { key: 'date', label: '日期' },
      { key: 'receptionCount', label: '接待' },
      { key: 'targetAmount', label: '标的金额' },
      { key: 'dealCount', label: '成交' },
      { key: 'dealAmount', label: '成交金额' },
      { key: 'conversionRate', label: '转化率', percent: true },
      { key: 'avgAmount', label: '客单价' },
      { key: 'unitQ', label: '单Q' },
    ]
  }
  if (props.stage === 'third-sales' && props.scope === 'personal') {
    return [
      { key: 'userName', label: '人员名字' },
      { key: 'dealAmount', label: '实际业绩' },
    ]
  }
  return [
    { key: 'date', label: '日期' },
    { key: 'dealAmount', label: '实际业绩' },
  ]
})

const formatCurrency = (value: unknown) => `¥${Number(value || 0).toLocaleString('zh-CN')}`
const formatPercent = (value: unknown) => `${(Number(value || 0) * 100).toFixed(2)}%`

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
  dateRange.value = [start, end]
  loadData()
}

const loadDepartmentOptions = async () => {
  const response = await fetchReportDepartments(props.stage)
  departmentOptions.value = response.options
}

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      departmentId: filters.departmentId,
    }
    const reportRows = await fetcher.value(params)
    rows.value = reportRows.rows as CurrentRow[]
  } finally {
    loading.value = false
  }
}

watch(dateRange, (value) => {
  filters.startDate = value[0] ? value[0].toISOString() : ''
  filters.endDate = value[1] ? value[1].toISOString() : ''
})

onMounted(async () => {
  if (!canViewCurrentReport.value) {
    return
  }

  await loadDepartmentOptions()
  applyQuickRange('day')
})
</script>

<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>{{ title }}</template>
      <el-alert title="报表统计按当前时间、部门、权限范围展示订单汇总数据，不会因为客户后续流转到其他阶段而丢失历史订单数据。" type="info" :closable="false" show-icon />
      <el-form inline>
        <el-form-item label="快捷筛选">
          <el-space>
            <el-button :type="activeQuickRange === 'day' ? 'primary' : 'default'" @click="applyQuickRange('day')">日</el-button>
            <el-button :type="activeQuickRange === 'week' ? 'primary' : 'default'" @click="applyQuickRange('week')">周</el-button>
            <el-button :type="activeQuickRange === 'month' ? 'primary' : 'default'" @click="applyQuickRange('month')">月</el-button>
          </el-space>
        </el-form-item>
        <el-form-item label="销售部门">
          <el-select v-model="filters.departmentId" clearable placeholder="全部部门" style="width: 220px">
            <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card>
      <template #header>{{ summaryTitle }}</template>
      <el-table :data="rows">
        <el-table-column v-for="column in columns" :key="column.key" :prop="column.key" :label="column.label" min-width="120">
          <template v-if="column.percent || ['depositAmount','tailAmount','fullAmount','totalAmount','avgAmount','targetAmount','dealAmount','unitQ'].includes(column.key)" #default="scope">
            <span v-if="column.percent">{{ formatPercent(scope.row[column.key]) }}</span>
            <span v-else>{{ formatCurrency(scope.row[column.key]) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
