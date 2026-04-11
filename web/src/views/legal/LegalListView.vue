<script setup lang="ts">
import { Delete, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { getFileName, isImageFile, toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { fetchLegalCases, fetchLegalUsers, saveLegalCase, transferLegalCaseToThirdSales } from '../../api/legal'
import { deleteCustomer } from '../../api/customers'
import type { CreateRefundCasePayload, LegalCaseItem, LegalCaseStage, SalesUserOption, SaveLegalCasePayload } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'

const canEditLegal = () => hasPermission('legal.edit')
const canTransferLegal = () => hasPermission('legal.transfer')
const canDeleteCustomers = () => hasPermission('customers.delete')
const canAssignLegal = () => hasPermission('legal.assign')
const canReviewFiling = () => hasPermission('legal.filing.review')
const canHandlePreTrial = () => hasPermission('legal.pretrial.handle')
const canCloseLegal = () => hasPermission('legal.close')
const canCreateRefund = () => hasPermission('refund.create')
const canOperateLegal = () => canEditLegal() || canAssignLegal() || canReviewFiling() || canHandlePreTrial() || canCloseLegal()
const canOnlyEditLegalBaseFields = () => canEditLegal() && !canAssignLegal() && !canReviewFiling() && !canHandlePreTrial() && !canCloseLegal()

const stageOptions: Array<{ label: string; value: LegalCaseStage }> = [
  { label: '待分配阶段', value: 'PENDING_ASSIGNMENT' },
  { label: '助理阶段', value: 'ASSISTANT' },
  { label: '立案专员阶段', value: 'FILING_SPECIALIST' },
  { label: '庭前阶段', value: 'PRE_TRIAL' },
  { label: '已结案', value: 'CLOSED' },
]

const stageQuickOptions: Array<{ label: string; value: LegalCaseStage | '' }> = [
  { label: '全部客户', value: '' },
  { label: '待分配', value: 'PENDING_ASSIGNMENT' },
  { label: '助理', value: 'ASSISTANT' },
  { label: '立案专员', value: 'FILING_SPECIALIST' },
  { label: '庭前', value: 'PRE_TRIAL' },
  { label: '已结案', value: 'CLOSED' },
]

const loading = ref(false)
const saving = ref(false)
const transferringId = ref<number | null>(null)
const refundingId = ref<number | null>(null)
const cases = ref<LegalCaseItem[]>([])
const total = ref(0)
const users = ref<SalesUserOption[]>([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const refundDialogVisible = ref(false)
const refundDraft = ref<CreateRefundCasePayload | null>(null)
const form = reactive<SaveLegalCasePayload>({
  customerId: 0,
  progressStatus: '',
  caseResult: '',
  remark: '',
  isCompleted: false,
  filingApproved: false,
  stage: 'PENDING_ASSIGNMENT',
  assistantCollected: false,
  assistantDocumented: false,
  archiveNeeded: false,
  archiveCompleted: false,
  filingReviewed: false,
  transferredToPreTrial: false,
  assistantCustomerSituationRemark: '',
  assistantFollowRemark: '',
  filingCustomerSituationRemark: '',
  filingFollowRemark: '',
  preTrialCustomerSituationRemark: '',
  preTrialFollowRemark: '',
  closeResult: '',
})
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]
const selectedStage = ref<LegalCaseStage | ''>('')
const activeCase = ref<LegalCaseItem | null>(null)

const legalUsers = computed(() => users.value.filter((item) => ['SUPER_ADMIN', 'LEGAL_MANAGER', 'LEGAL'].includes(item.roleCode || '')))

const stageLabelMap: Record<LegalCaseStage, string> = {
  PENDING_ASSIGNMENT: '待分配阶段',
  ASSISTANT: '助理阶段',
  FILING_SPECIALIST: '立案专员阶段',
  PRE_TRIAL: '庭前阶段',
  CLOSED: '已结案',
}

const formatStage = (stage?: LegalCaseStage) => (stage ? stageLabelMap[stage] : '-')

const loadData = async () => {
  loading.value = true
  try {
    const requests: Array<Promise<unknown>> = [fetchLegalCases({ page: currentPage.value, pageSize: pageSize.value, stage: selectedStage.value || undefined }), fetchLegalUsers()]
    const [caseResult, userList] = await Promise.all(requests)
    const casePage = caseResult as { items: LegalCaseItem[]; total: number }
    cases.value = casePage.items
    total.value = casePage.total
    users.value = (userList as SalesUserOption[] | undefined) || []
    if (activeCase.value) {
      activeCase.value = cases.value.find((item) => item.customerId === activeCase.value?.customerId) || activeCase.value
      if (!cases.value.some((item) => item.customerId === activeCase.value?.customerId)) {
        detailVisible.value = false
      }
    }
  } finally {
    loading.value = false
  }
}

const openDialog = (item: LegalCaseItem) => {
  activeCase.value = item
  form.customerId = item.customerId
  form.progressStatus = item.progressStatus || '处理中'
  form.caseResult = item.caseResult || ''
  form.remark = item.remark || ''
  form.startDate = item.startDate ? item.startDate.slice(0, 16) : ''
  form.isCompleted = item.isCompleted
  form.filingApproved = item.filingApproved
  form.stage = item.stage || 'PENDING_ASSIGNMENT'
  form.assistantUserId = item.assistantUserId
  form.filingSpecialistUserId = item.filingSpecialistUserId
  form.preTrialUserId = item.preTrialUserId
  form.assistantCollected = item.assistantCollected
  form.assistantDocumented = item.assistantDocumented
  form.archiveNeeded = item.archiveNeeded
  form.archiveCompleted = item.archiveCompleted
  form.filingReviewed = item.filingReviewed
  form.transferredToPreTrial = item.transferredToPreTrial
  form.assistantCustomerSituationRemark = item.assistantCustomerSituationRemark || ''
  form.assistantFollowRemark = item.assistantFollowRemark || ''
  form.filingCustomerSituationRemark = item.filingCustomerSituationRemark || ''
  form.filingFollowRemark = item.filingFollowRemark || ''
  form.preTrialCustomerSituationRemark = item.preTrialCustomerSituationRemark || ''
  form.preTrialFollowRemark = item.preTrialFollowRemark || ''
  form.closeResult = item.closeResult || ''
  dialogVisible.value = true
}

const submit = async () => {
  saving.value = true
  try {
    await saveLegalCase(form)
    ElMessage.success('法务进度已保存')
    dialogVisible.value = false
    await loadData()
  } finally {
    saving.value = false
  }
}

const quickCreateRefund = async (item: LegalCaseItem) => {
  refundingId.value = item.customerId
  try {
    refundDraft.value = {
      customerId: item.customerId,
      customerName: item.name,
      phone: item.phone,
      sourceStage: 'LEGAL',
      firstSalesUserId: item.firstSalesUserId,
      reason: `客户在法务阶段申请退款，当前进度：${item.progressStatus || '处理中'}`,
    }
    refundDialogVisible.value = true
  } finally {
    refundingId.value = null
  }
}

const canShowTransfer = (item: LegalCaseItem) => canTransferLegal() && item.stage === 'CLOSED' && item.isCompleted && item.filingApproved && item.filingReviewed && item.transferredToPreTrial && item.currentStatus === '待转三销'

const legalActionLabel = computed(() => {
  if (canCloseLegal()) return '结案处理'
  if (canHandlePreTrial()) return '庭前处理'
  if (canReviewFiling()) return '立案审核'
  if (canAssignLegal()) return '分派办理'
  if (canEditLegal()) return '跟进记录'
  return '查看详情'
})

const legalActionTip = computed(() => {
  if (canCloseLegal()) return '可处理结案结果，并补充法务全流程信息'
  if (canHandlePreTrial()) return '可办理庭前阶段，并维护前序法务信息'
  if (canReviewFiling()) return '可审核资料、标记立案通过，并维护前序法务信息'
  if (canAssignLegal()) return '可分派助理、立案专员、庭前负责人，并维护案件进度'
  if (canEditLegal()) return '可登记本人负责的法务跟进信息'
  return '可查看法务案件详情'
})

const transferToThirdSales = async (item: LegalCaseItem) => {
  transferringId.value = item.customerId
  try {
    await transferLegalCaseToThirdSales(item.customerId)
    ElMessage.success('已转入三销接待')
    await loadData()
  } finally {
    transferringId.value = null
  }
}

const handleDeleteCustomer = async (item: LegalCaseItem) => {
  await ElMessageBox.confirm(`确认删除客户“${item.name}”吗？删除后该客户的相关业绩与跟进数据也会一并删除。`, '删除客户', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  saving.value = true
  try {
    await deleteCustomer(item.customerId)
    ElMessage.success('客户已删除')
    await loadData()
  } finally {
    saving.value = false
  }
}

const paginatedCases = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return cases.value.slice(start, start + pageSize.value)
})

const selectCase = (item: LegalCaseItem | null) => {
  activeCase.value = item
  detailVisible.value = Boolean(item)
}

const handleStageChange = async () => {
  currentPage.value = 1
  await loadData()
}

const openAttachment = (url?: string) => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    ElMessage.warning('附件地址无效')
    return
  }
  window.open(absoluteUrl, '_blank', 'noopener')
}
onMounted(() => {
  loadData()
})

</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>法务系统</template>
      <div class="legal-layout">
        <el-card shadow="never" class="legal-list-card">
          <template #header>
            <div class="card-header-row">
              <span>法务客户列表</span>
              <el-segmented v-model="selectedStage" :options="stageQuickOptions" @change="handleStageChange" />
            </div>
          </template>
          <el-table v-loading="loading" :data="paginatedCases" highlight-current-row @current-change="selectCase" @row-click="selectCase">
            <el-table-column label="客户编号" prop="customerNo" min-width="150" />
            <el-table-column label="客户姓名" prop="name" min-width="120" />
            <el-table-column label="手机号码" min-width="130">
              <template #default="scope">
                {{ formatPhone(scope.row.phone, scope.row) }}
              </template>
            </el-table-column>
            <el-table-column label="二销付款" prop="secondPaymentAmount" min-width="100" />
            <el-table-column label="当前状态" prop="currentStatus" min-width="130" />
            <el-table-column label="法务阶段" min-width="140">
              <template #default="scope">{{ formatStage(scope.row.stage) }}</template>
            </el-table-column>
            <el-table-column label="法务进度" prop="progressStatus" min-width="140" />
            <el-table-column label="操作" width="320">
              <template #default="scope">
                <div class="action-cell compact-action-cell">
                  <el-button v-if="canAssignLegal()" link type="warning" @click="openDialog(scope.row)">分配岗位</el-button>
                  <el-tooltip v-if="canOperateLegal()" :content="legalActionTip" placement="top">
                    <el-button link type="primary" @click="openDialog(scope.row)">{{ legalActionLabel }}</el-button>
                  </el-tooltip>
                  <el-button v-if="canCreateRefund()" link type="danger" :loading="refundingId === scope.row.customerId" @click="quickCreateRefund(scope.row)">申请退款</el-button>
                  <el-tooltip v-if="canShowTransfer(scope.row)" content="法务流程已完成，可转入三销接待" placement="top">
                    <el-button link type="success" :loading="transferringId === scope.row.customerId" @click="transferToThirdSales(scope.row)">移交三销</el-button>
                  </el-tooltip>
                  <el-tooltip v-if="canDeleteCustomers()" content="删除客户" placement="top">
                    <el-button link type="danger" :icon="Delete" @click="handleDeleteCustomer(scope.row)" />
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
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
      </div>
    </el-card>

    <el-drawer
      v-model="detailVisible"
      :title="activeCase ? `客户详情 - ${activeCase.name}` : '客户详情'"
      size="70%"
      destroy-on-close
    >
      <template v-if="activeCase">
        <div class="page-stack-sm legal-detail-drawer-body">
          <el-card shadow="never">
            <template #header>客户情况、岗位流转与上游证据</template>
            <div class="page-stack-sm">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="当前法务阶段">{{ formatStage(activeCase.stage) }}</el-descriptions-item>
                <el-descriptions-item label="当前负责人">{{ activeCase.legalUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="法务助理">{{ activeCase.assistantUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="立案专员">{{ activeCase.filingSpecialistUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="庭前负责人">{{ activeCase.preTrialUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="客户基础情况说明">{{ activeCase.customerSituationRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="一销情况说明">{{ activeCase.firstSalesRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="二销情况说明">{{ activeCase.secondSalesRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="法务备注">{{ activeCase.remark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="助理客户情况" :span="2">{{ activeCase.assistantCustomerSituationRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="助理跟进说明" :span="2">{{ activeCase.assistantFollowRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="立案客户情况" :span="2">{{ activeCase.filingCustomerSituationRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="立案跟进说明" :span="2">{{ activeCase.filingFollowRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="庭前客户情况" :span="2">{{ activeCase.preTrialCustomerSituationRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="庭前跟进说明" :span="2">{{ activeCase.preTrialFollowRemark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="收集证据">{{ activeCase.assistantCollected ? '已完成' : '未完成' }}</el-descriptions-item>
                <el-descriptions-item label="文书撰写">{{ activeCase.assistantDocumented ? '已完成' : '未完成' }}</el-descriptions-item>
                <el-descriptions-item label="是否查档">{{ activeCase.archiveNeeded ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="查档完成">{{ activeCase.archiveCompleted ? '已完成' : '未完成' }}</el-descriptions-item>
                <el-descriptions-item label="资料审核">{{ activeCase.filingReviewed ? '已审核' : '未审核' }}</el-descriptions-item>
                <el-descriptions-item label="立案通过">{{ activeCase.filingApproved ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="已转庭前">{{ activeCase.transferredToPreTrial ? '是' : '否' }}</el-descriptions-item>
                <el-descriptions-item label="结案结果">{{ activeCase.closeResult || '-' }}</el-descriptions-item>
              </el-descriptions>
              <el-card shadow="never">
                <template #header>处理轨迹</template>
                <el-timeline>
                  <el-timeline-item v-if="activeCase.acceptedAt" :timestamp="activeCase.acceptedAt">已接案</el-timeline-item>
                  <el-timeline-item v-if="activeCase.assistantTransferredAt" :timestamp="activeCase.assistantTransferredAt">已转立案专员</el-timeline-item>
                  <el-timeline-item v-if="activeCase.filingApprovedAt" :timestamp="activeCase.filingApprovedAt">立案通过</el-timeline-item>
                  <el-timeline-item v-if="activeCase.preTrialTransferredAt" :timestamp="activeCase.preTrialTransferredAt">已转庭前</el-timeline-item>
                </el-timeline>
              </el-card>
              <div class="page-stack-sm">
                <div class="sales-section-card">
                  <div class="evidence-section-title">一销信息</div>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="一销备注">{{ activeCase.firstSalesRemark || '-' }}</el-descriptions-item>
                  </el-descriptions>
                  <div class="attachment-block">
                    <div class="attachment-block-title">一销材料</div>
                    <div v-if="activeCase.firstSalesEvidenceFileUrls.length" class="evidence-grid">
                      <div v-for="(item, index) in activeCase.firstSalesEvidenceFileUrls" :key="item + '-first-' + index" class="evidence-card">
                        <img v-if="isImageFile(item)" :src="toAbsoluteFileUrl(item)" :alt="'一销材料' + (index + 1)" class="evidence-image" @click="openAttachment(item)" />
                        <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(item)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(item) || '一销材料' + (index + 1) }}</span>
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-else description="暂无一销材料" />
                  </div>
                </div>

                <div class="sales-section-card">
                  <div class="evidence-section-title">二销信息</div>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="二销备注">{{ activeCase.secondSalesRemark || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="付款信息">{{ activeCase.secondSalesPaymentAmount ?? '-' }} / {{ activeCase.secondSalesPaymentStatus || '-' }}</el-descriptions-item>
                  </el-descriptions>
                  <div class="attachment-block">
                    <div class="attachment-block-title">付款截图</div>
                    <div v-if="activeCase.secondSalesPaymentScreenshotUrl" class="evidence-grid">
                      <div class="evidence-card">
                        <img :src="toAbsoluteFileUrl(activeCase.secondSalesPaymentScreenshotUrl)" alt="二销付款截图" class="evidence-image" @click="openAttachment(activeCase.secondSalesPaymentScreenshotUrl)" />
                      </div>
                    </div>
                    <el-empty v-else description="暂无二销付款截图" />
                  </div>
                  <div class="attachment-block">
                    <div class="attachment-block-title">聊天记录</div>
                    <div v-if="activeCase.secondSalesChatRecordUrl" class="evidence-grid">
                      <div class="evidence-card">
                        <img v-if="isImageFile(activeCase.secondSalesChatRecordUrl)" :src="toAbsoluteFileUrl(activeCase.secondSalesChatRecordUrl)" alt="二销聊天记录" class="evidence-image" @click="openAttachment(activeCase.secondSalesChatRecordUrl)" />
                        <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(activeCase.secondSalesChatRecordUrl)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(activeCase.secondSalesChatRecordUrl) || '二销聊天记录' }}</span>
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-else description="暂无二销聊天记录" />
                  </div>
                  <div class="attachment-block">
                    <div class="attachment-block-title">证据材料</div>
                    <div v-if="activeCase.secondSalesEvidenceFileUrls.length" class="evidence-grid">
                      <div v-for="(item, index) in activeCase.secondSalesEvidenceFileUrls" :key="item + '-second-' + index" class="evidence-card">
                        <img v-if="isImageFile(item)" :src="toAbsoluteFileUrl(item)" :alt="'二销材料' + (index + 1)" class="evidence-image" @click="openAttachment(item)" />
                        <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(item)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(item) || '二销材料' + (index + 1) }}</span>
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-else description="暂无二销材料" />
                  </div>
                </div>

                <div class="sales-section-card">
                  <div class="evidence-section-title">三销信息</div>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="三销备注">{{ activeCase.thirdSalesRemark || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="付款信息">{{ activeCase.thirdSalesPaymentAmount ?? '-' }} / {{ activeCase.thirdSalesPaymentStatus || '-' }}</el-descriptions-item>
                  </el-descriptions>
                  <div class="attachment-block">
                    <div class="attachment-block-title">付款截图</div>
                    <div v-if="activeCase.thirdSalesPaymentScreenshotUrl" class="evidence-grid">
                      <div class="evidence-card">
                        <img :src="toAbsoluteFileUrl(activeCase.thirdSalesPaymentScreenshotUrl)" alt="三销付款截图" class="evidence-image" @click="openAttachment(activeCase.thirdSalesPaymentScreenshotUrl)" />
                      </div>
                    </div>
                    <el-empty v-else description="暂无三销付款截图" />
                  </div>
                  <div class="attachment-block">
                    <div class="attachment-block-title">聊天记录</div>
                    <div v-if="activeCase.thirdSalesChatRecordUrl" class="evidence-grid">
                      <div class="evidence-card">
                        <img v-if="isImageFile(activeCase.thirdSalesChatRecordUrl)" :src="toAbsoluteFileUrl(activeCase.thirdSalesChatRecordUrl)" alt="三销聊天记录" class="evidence-image" @click="openAttachment(activeCase.thirdSalesChatRecordUrl)" />
                        <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(activeCase.thirdSalesChatRecordUrl)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(activeCase.thirdSalesChatRecordUrl) || '三销聊天记录' }}</span>
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-else description="暂无三销聊天记录" />
                  </div>
                  <div class="attachment-block">
                    <div class="attachment-block-title">证据材料</div>
                    <div v-if="activeCase.thirdSalesEvidenceFileUrls.length" class="evidence-grid">
                      <div v-for="(item, index) in activeCase.thirdSalesEvidenceFileUrls" :key="item + '-third-' + index" class="evidence-card">
                        <img v-if="isImageFile(item)" :src="toAbsoluteFileUrl(item)" :alt="'三销材料' + (index + 1)" class="evidence-image" @click="openAttachment(item)" />
                        <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(item)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(item) || '三销材料' + (index + 1) }}</span>
                        </el-button>
                      </div>
                    </div>
                    <el-empty v-else description="暂无三销材料" />
                  </div>
                </div>

                <div>
                  <div class="evidence-section-title">上游证据总览</div>
                  <div v-if="activeCase.upstreamEvidenceFileUrls.length" class="evidence-grid">
                    <div v-for="(item, index) in activeCase.upstreamEvidenceFileUrls" :key="item + '-' + index" class="evidence-card">
                      <img v-if="isImageFile(item)" :src="toAbsoluteFileUrl(item)" :alt="'上游证据' + (index + 1)" class="evidence-image" @click="openAttachment(item)" />
                      <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(item)">
                        <el-icon><Document /></el-icon>
                        <span>{{ getFileName(item) || '上游证据' + (index + 1) }}</span>
                      </el-button>
                    </div>
                  </div>
                  <el-empty v-else description="暂无上游证据" />
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </template>
      <el-empty v-else description="请选择法务案件" />
    </el-drawer>

    <el-dialog v-model="dialogVisible" title="处理法务案件" width="720px">
      <el-form label-width="130px" class="form-grid">
        <el-form-item label="当前负责人">
          <div class="static-value">{{ cases.find((item) => item.customerId === form.customerId)?.legalUserName || '-' }}</div>
        </el-form-item>
        <el-form-item label="法务阶段">
          <el-select v-model="form.stage" style="width: 100%" :disabled="canOnlyEditLegalBaseFields()">
            <el-option v-for="option in stageOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canAssignLegal()" label="法务助理">
          <el-select v-model="form.assistantUserId" clearable style="width: 100%">
            <el-option v-for="user in legalUsers" :key="user.id" :label="user.realName + '（' + user.roleName + '）'" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canAssignLegal()" label="立案专员">
          <el-select v-model="form.filingSpecialistUserId" clearable style="width: 100%">
            <el-option v-for="user in legalUsers" :key="user.id" :label="user.realName + '（' + user.roleName + '）'" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="canAssignLegal()" label="庭前负责人">
          <el-select v-model="form.preTrialUserId" clearable style="width: 100%">
            <el-option v-for="user in legalUsers" :key="user.id" :label="user.realName + '（' + user.roleName + '）'" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="法务进度" class="full-width">
          <el-input v-model="form.progressStatus" placeholder="请输入法务进度" />
        </el-form-item>
        <el-form-item label="处理结果" class="full-width">
          <el-input v-model="form.caseResult" placeholder="请输入处理结果" />
        </el-form-item>
        <el-form-item label="备注" class="full-width">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入法务备注" />
        </el-form-item>
        <el-form-item label="助理客户情况" class="full-width">
          <el-input v-model="form.assistantCustomerSituationRemark" type="textarea" :rows="3" placeholder="请输入助理客户情况说明" />
        </el-form-item>
        <el-form-item label="助理跟进说明" class="full-width">
          <el-input v-model="form.assistantFollowRemark" type="textarea" :rows="3" placeholder="请输入助理跟进说明" />
        </el-form-item>
        <el-form-item label="立案客户情况" class="full-width">
          <el-input v-model="form.filingCustomerSituationRemark" type="textarea" :rows="3" placeholder="请输入立案专员客户情况说明" />
        </el-form-item>
        <el-form-item label="立案跟进说明" class="full-width">
          <el-input v-model="form.filingFollowRemark" type="textarea" :rows="3" placeholder="请输入立案专员跟进说明" />
        </el-form-item>
        <el-form-item label="庭前客户情况" class="full-width">
          <el-input v-model="form.preTrialCustomerSituationRemark" type="textarea" :rows="3" placeholder="请输入庭前客户情况说明" />
        </el-form-item>
        <el-form-item label="庭前跟进说明" class="full-width">
          <el-input v-model="form.preTrialFollowRemark" type="textarea" :rows="3" placeholder="请输入庭前跟进说明" />
        </el-form-item>
        <el-form-item label="已收集证据">
          <el-switch v-model="form.assistantCollected" />
        </el-form-item>
        <el-form-item label="已写文书">
          <el-switch v-model="form.assistantDocumented" />
        </el-form-item>
        <el-form-item label="需要查档">
          <el-switch v-model="form.archiveNeeded" />
        </el-form-item>
        <el-form-item label="查档完成">
          <el-switch v-model="form.archiveCompleted" :disabled="!form.archiveNeeded" />
        </el-form-item>
        <el-form-item v-if="canReviewFiling()" label="资料已审核">
          <el-switch v-model="form.filingReviewed" />
        </el-form-item>
        <el-form-item v-if="canReviewFiling()" label="立案成功">
          <el-switch v-model="form.filingApproved" />
        </el-form-item>
        <el-form-item v-if="canHandlePreTrial()" label="转入庭前">
          <el-switch v-model="form.transferredToPreTrial" />
        </el-form-item>
        <el-form-item v-if="canCloseLegal()" label="完成案件">
          <el-switch v-model="form.isCompleted" />
        </el-form-item>
        <el-form-item v-if="canCloseLegal()" label="结案结果" class="full-width">
          <el-input v-model="form.closeResult" placeholder="请输入结案结果" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadData" />
  </div>
</template>

<style scoped>
.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.compact-action-cell :deep(.el-button) {
  padding: 2px 4px;
  font-size: 12px;
}

.legal-layout {
  display: block;
}

.legal-list-card {
  min-width: 0;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.legal-filters {
  display: none;
}

.sales-section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.attachment-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-block-title {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.evidence-section-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.evidence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.evidence-card {
  padding: 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.evidence-image {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
}

.evidence-link {
  justify-content: flex-start;
  padding: 0;
}

.static-value {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}

.legal-detail-drawer-body {
  padding-right: 8px;
}
</style>
