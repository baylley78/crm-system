<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchJudicialComplaintCaseDetail, fetchJudicialComplaintCases } from '../../api/judicial-complaints'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import type { JudicialComplaintCaseFilters, JudicialComplaintCaseItem } from '../../types'
import JudicialComplaintCreateDialog from './JudicialComplaintCreateDialog.vue'

const canCreateComplaint = () => hasPermission('judicialComplaint.create')
const canCreateQuality = () => hasPermission('quality.create')

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const creatingDialogVisible = ref(false)
const cases = ref<JudicialComplaintCaseItem[]>([])
const activeCase = ref<JudicialComplaintCaseItem | null>(null)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]

const filters = reactive<JudicialComplaintCaseFilters>({
  handlingStatus: '',
})

const handlingStatusOptions = [
  { label: '待处理', value: 'PENDING' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已处理', value: 'HANDLED' },
  { label: '无需处理', value: 'IGNORED' },
]

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const handlingTagType = (status?: string) => {
  if (status === 'HANDLED') return 'success'
  if (status === 'PROCESSING') return 'warning'
  if (status === 'IGNORED') return 'info'
  return 'danger'
}
const qualityTagType = (checked?: boolean) => (checked ? 'success' : 'info')

const loadData = async () => {
  loading.value = true
  try {
    const result = await fetchJudicialComplaintCases({ ...filters, page: currentPage.value, pageSize: pageSize.value })
    cases.value = result.items
    total.value = result.total

    if (activeCase.value) {
      const matched = result.items.find((item) => item.id === activeCase.value?.id)
      activeCase.value = matched ? await fetchJudicialComplaintCaseDetail(matched.id) : result.items[0] ? await fetchJudicialComplaintCaseDetail(result.items[0].id) : null
    } else {
      activeCase.value = result.items[0] ? await fetchJudicialComplaintCaseDetail(result.items[0].id) : null
    }
  } finally {
    loading.value = false
  }
}

const selectCase = async (item: JudicialComplaintCaseItem | null) => {
  if (!item) {
    activeCase.value = null
    return
  }
  activeCase.value = await fetchJudicialComplaintCaseDetail(item.id)
}

const goToQuality = async (item: JudicialComplaintCaseItem) => {
  await router.push({
    path: '/quality',
    query: {
      judicialComplaintCaseId: String(item.id),
      customerId: item.customerId ? String(item.customerId) : undefined,
      customerName: item.customerName,
      phone: item.phone,
      complaintSubject: item.complaintSubject,
      complaintReason: item.complaintReason,
    },
  })
}

const openQualityScreenshot = (url?: string) => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    return
  }
  window.open(absoluteUrl, '_blank', 'noopener')
}

const handleCreateSuccess = async () => {
  await loadData()
}

watch(pageSize, async () => {
  currentPage.value = 1
  await loadData()
})

watch(currentPage, async () => {
  await loadData()
})

onMounted(loadData)
</script>

<template>
  <div class="page-stack complaint-page">
    <el-card>
      <template #header>
        <div class="card-header-row">
          <span>司法投诉</span>
          <el-space wrap>
            <el-select v-model="filters.handlingStatus" placeholder="处理状态" clearable style="width: 160px" @change="loadData">
              <el-option v-for="item in handlingStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button v-if="canCreateComplaint()" type="primary" @click="creatingDialogVisible = true">新建司法投诉</el-button>
          </el-space>
        </div>
      </template>

      <div class="complaint-layout">
        <el-card shadow="never" class="complaint-list-card">
          <template #header>
            <div class="card-header-row">
              <span>投诉列表</span>
              <span class="table-caption">重点查看是否处理投诉</span>
            </div>
          </template>

          <el-table v-loading="loading" :data="cases" highlight-current-row @row-click="selectCase" @current-change="selectCase">
            <el-table-column label="客户姓名" prop="customerName" min-width="120" />
            <el-table-column label="手机号" min-width="130">
              <template #default="scope">{{ formatPhone(scope.row.phone, scope.row) }}</template>
            </el-table-column>
            <el-table-column label="投诉主体" prop="complaintSubject" min-width="140" />
            <el-table-column label="所属团队" prop="teamName" min-width="130" />
            <el-table-column label="投诉时间" min-width="180">
              <template #default="scope">{{ formatDateTime(scope.row.complaintTime) }}</template>
            </el-table-column>
            <el-table-column label="是否处理投诉" min-width="140">
              <template #default="scope">
                <el-tag :type="scope.row.shouldHandle ? 'danger' : 'info'">{{ scope.row.shouldHandle ? '需要处理' : '无需处理' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="处理状态" min-width="120">
              <template #default="scope">
                <el-tag :type="handlingTagType(scope.row.handlingStatus)">{{ scope.row.handlingStatusLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="质检状态" min-width="120">
              <template #default="scope">
                <el-tag :type="qualityTagType(scope.row.qualityChecked)">{{ scope.row.qualityChecked ? '已检查' : '未检查' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="提交人" prop="submittedByName" min-width="120" />
          </el-table>

          <div class="table-pagination">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="pageSizeOptions"
              :total="total"
              layout="total, sizes, prev, pager, next, jumper"
              background
            />
          </div>
        </el-card>

        <el-card shadow="never" class="complaint-detail-card">
          <template #header>
            <div class="card-header-row">
              <span>投诉详情</span>
              <el-button v-if="activeCase && !activeCase.qualityChecked && canCreateQuality()" type="primary" link @click="goToQuality(activeCase)">发起质检</el-button>
            </div>
          </template>

          <template v-if="activeCase">
            <div class="page-stack-sm">
              <div class="status-banner">
                <div>
                  <div class="status-title">是否处理投诉</div>
                  <div class="status-value">{{ activeCase.shouldHandle ? '需要处理' : '无需处理' }}</div>
                </div>
                <el-space direction="vertical" alignment="end">
                  <el-tag size="large" :type="handlingTagType(activeCase.handlingStatus)">{{ activeCase.handlingStatusLabel }}</el-tag>
                  <el-tag size="large" :type="qualityTagType(activeCase.qualityChecked)">{{ activeCase.qualityChecked ? '已检查' : '未检查' }}</el-tag>
                </el-space>
              </div>

              <el-descriptions :column="2" border>
                <el-descriptions-item label="投诉主体">{{ activeCase.complaintSubject }}</el-descriptions-item>
                <el-descriptions-item label="投诉时间">{{ formatDateTime(activeCase.complaintTime) }}</el-descriptions-item>
                <el-descriptions-item label="客户姓名">{{ activeCase.customerName }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ formatPhone(activeCase.phone) }}</el-descriptions-item>
                <el-descriptions-item label="所属团队">{{ activeCase.teamName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="部门">{{ activeCase.departmentName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="本人或亲属">{{ activeCase.relationToCustomer || '-' }}</el-descriptions-item>
                <el-descriptions-item label="提交人">{{ activeCase.submittedByName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="一销签约时间">{{ formatDateTime(activeCase.firstSignTime) }}</el-descriptions-item>
                <el-descriptions-item label="二销签约时间">{{ formatDateTime(activeCase.secondSignTime) }}</el-descriptions-item>
                <el-descriptions-item label="一销成交金额">{{ formatCurrency(activeCase.firstDealAmount) }}</el-descriptions-item>
                <el-descriptions-item label="二销成交金额">{{ formatCurrency(activeCase.secondDealAmount) }}</el-descriptions-item>
                <el-descriptions-item label="一销人员">{{ activeCase.firstSalesName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="二销人员">{{ activeCase.secondSalesName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="法务助理">{{ activeCase.legalAssistantName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="退款金额">{{ formatCurrency(activeCase.refundAmount) }}</el-descriptions-item>
                <el-descriptions-item label="投诉前是否介入">{{ activeCase.intervenedBeforeComplaint ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="是否突然要退费">{{ activeCase.suddenRefundRequest ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="是否为第三方引导">{{ activeCase.thirdPartyGuidance ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="进度">{{ activeCase.progress || '-' }}</el-descriptions-item>
                <el-descriptions-item label="客户投诉原因" :span="2">{{ activeCase.complaintReason }}</el-descriptions-item>
                <el-descriptions-item label="总结" :span="2">{{ activeCase.summary || '-' }}</el-descriptions-item>
              </el-descriptions>

              <el-card shadow="never">
                <template #header>质检记录</template>
                <template v-if="activeCase.qualityRecord">
                  <el-descriptions :column="2" border>
                    <el-descriptions-item label="质检状态">已检查</el-descriptions-item>
                    <el-descriptions-item label="检查时间">{{ formatDateTime(activeCase.qualityCheckedAt) }}</el-descriptions-item>
                    <el-descriptions-item label="责任人">{{ activeCase.qualityRecord.responsibleName || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="处罚金额">{{ formatCurrency(activeCase.qualityRecord.penaltyAmount) }}</el-descriptions-item>
                    <el-descriptions-item label="质检事宜" :span="2">{{ activeCase.qualityRecord.matter }}</el-descriptions-item>
                    <el-descriptions-item label="违规截图" :span="2">
                      <el-button v-if="activeCase.qualityRecord.screenshotUrl" link type="primary" @click="openQualityScreenshot(activeCase.qualityRecord.screenshotUrl)">查看截图</el-button>
                      <span v-else>-</span>
                    </el-descriptions-item>
                  </el-descriptions>
                </template>
                <el-empty v-else description="暂未质检">
                  <el-button v-if="canCreateQuality()" type="primary" @click="goToQuality(activeCase)">去质检</el-button>
                </el-empty>
              </el-card>
            </div>
          </template>
          <el-empty v-else description="请选择司法投诉" />
        </el-card>
      </div>
    </el-card>

    <JudicialComplaintCreateDialog v-model:visible="creatingDialogVisible" :loading="saving" @success="handleCreateSuccess" />
  </div>
</template>

<style scoped>
.complaint-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: 14px;
}

.complaint-list-card,
.complaint-detail-card {
  min-width: 0;
}

.table-caption {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-5);
}

.status-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.status-value {
  margin-top: 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-color-danger-dark-2);
}
</style>
