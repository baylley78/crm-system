<script setup lang="ts">
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { nextTick, reactive, ref } from 'vue'
import { getFileName, isImageFile, toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { formatPhone } from '../../utils/permissions'
import { createCustomerFollow, fetchCustomerDetail, updateCustomerStatus } from '../../api/customers'
import type { CreateCustomerFollowPayload, CustomerDetail, CustomerStatusCode } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  updated: []
}>()

const detail = ref<CustomerDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const currentCustomerId = ref<number | null>(null)
const refundSubmitting = ref(false)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const attachmentPreviewVisible = ref(false)
const attachmentPreviewTitle = ref('附件预览')
const attachmentPreviewImageUrl = ref('')
const attachmentPreviewFileUrl = ref('')
const attachmentPreviewFailed = ref(false)
const drawerBodyRef = ref<HTMLElement | null>(null)

type CustomerDetailFocusSection = 'sales-summary' | 'prior-sales-evidence' | 'legal' | 'mediation'

const panelSectionMap: Record<CustomerDetailFocusSection, string> = {
  'sales-summary': 'sales-summary',
  'prior-sales-evidence': 'prior-sales-evidence',
  legal: 'legal',
  mediation: 'mediation',
}

const getPanelBodySelector = (section: CustomerDetailFocusSection) => `.customer-detail-collapse .el-collapse-item[name="${panelSectionMap[section]}"] .el-collapse-item__wrap`

const statusOptions: Array<{ label: string; value: CustomerStatusCode }> = [
  { label: '初始建档', value: 'INITIAL' },
  { label: '待补尾款', value: 'PENDING_TAIL_PAYMENT' },
  { label: '待分配二销', value: 'PENDING_SECOND_SALES_ASSIGNMENT' },
  { label: '二销跟进中', value: 'SECOND_SALES_FOLLOWING' },
  { label: '待转法务', value: 'PENDING_LEGAL' },
  { label: '法务处理中', value: 'LEGAL_PROCESSING' },
  { label: '待转调解', value: 'PENDING_MEDIATION' },
  { label: '待转三销', value: 'PENDING_THIRD_SALES' },
  { label: '三销开发中', value: 'THIRD_SALES_FOLLOWING' },
  { label: '已完成三销', value: 'COMPLETED_THIRD_SALES' },
  { label: '调解处理中', value: 'MEDIATION_PROCESSING' },
  { label: '调解完成', value: 'MEDIATION_COMPLETED' },
]

const stageLabelMap: Record<string, string> = {
  FIRST_SALES: '一销跟进',
  SECOND_SALES: '二销跟进',
  LEGAL: '法务跟进',
  THIRD_SALES: '三销跟进',
  MEDIATION: '调解跟进',
}

const approvalTypeLabelMap: Record<'REIMBURSEMENT' | 'LEAVE', string> = {
  REIMBURSEMENT: '报销申请',
  LEAVE: '请假申请',
}

const approvalStatusLabelMap: Record<'PENDING' | 'APPROVED' | 'REJECTED', string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}

const statusLabelToCode: Record<string, CustomerStatusCode> = {
  初始建档: 'INITIAL',
  待补尾款: 'PENDING_TAIL_PAYMENT',
  待分配二销: 'PENDING_SECOND_SALES_ASSIGNMENT',
  二销跟进中: 'SECOND_SALES_FOLLOWING',
  待转法务: 'PENDING_LEGAL',
  法务处理中: 'LEGAL_PROCESSING',
  待转调解: 'PENDING_MEDIATION',
  待转三销: 'PENDING_THIRD_SALES',
  三销开发中: 'THIRD_SALES_FOLLOWING',
  已完成三销: 'COMPLETED_THIRD_SALES',
  调解处理中: 'MEDIATION_PROCESSING',
  调解完成: 'MEDIATION_COMPLETED',
}

const form = reactive<CreateCustomerFollowPayload & { status: CustomerStatusCode; nextFollowTimeText: string }>({
  content: '',
  nextFollowTime: undefined,
  nextFollowTimeText: '',
  status: 'INITIAL',
})

const activePanels = ref<string[]>(['profile'])

const formatDateTime = (value?: string | null) => value?.replace('T', ' ').slice(0, 19) || '-'
const formatStage = (value: string) => stageLabelMap[value] || value
const formatApprovalType = (value: 'REIMBURSEMENT' | 'LEAVE') => approvalTypeLabelMap[value]
const formatApprovalStatus = (value: 'PENDING' | 'APPROVED' | 'REJECTED') => approvalStatusLabelMap[value]
const formatEvidenceSource = (value: 'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES') => {
  if (value === 'FIRST_SALES') {
    return '一销'
  }
  if (value === 'SECOND_SALES') {
    return '二销'
  }
  if (value === 'MEDIATION') {
    return '调解'
  }
  return '三销'
}

const evidenceSourceTagTypeMap: Record<'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES', 'success' | 'warning' | 'danger' | 'info'> = {
  FIRST_SALES: 'success',
  SECOND_SALES: 'warning',
  MEDIATION: 'danger',
  THIRD_SALES: 'info',
}

const getEvidenceSourceTagType = (value: 'FIRST_SALES' | 'SECOND_SALES' | 'MEDIATION' | 'THIRD_SALES') => evidenceSourceTagTypeMap[value]

const getLoadErrorMessage = (error: any) => error?.response?.data?.message || error?.message || '客户详情加载失败'

const openAttachmentPreview = (url?: string, title = '附件预览') => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    return
  }
  attachmentPreviewTitle.value = title
  attachmentPreviewFailed.value = false
  if (isImageFile(url)) {
    attachmentPreviewImageUrl.value = absoluteUrl
    attachmentPreviewFileUrl.value = ''
  } else {
    attachmentPreviewImageUrl.value = ''
    attachmentPreviewFileUrl.value = absoluteUrl
  }
  attachmentPreviewVisible.value = true
}

const resetForm = () => {
  form.content = ''
  form.nextFollowTime = undefined
  form.nextFollowTimeText = ''
  form.status = detail.value ? statusLabelToCode[detail.value.currentStatus] || 'INITIAL' : 'INITIAL'
}

const scrollToSection = async (section?: CustomerDetailFocusSection) => {
  if (!section) {
    return
  }

  await nextTick()
  const body = drawerBodyRef.value
  const target = body?.querySelector(getPanelBodySelector(section)) as HTMLElement | null
  if (!body || !target) {
    return
  }

  body.scrollTo({
    top: Math.max(0, target.offsetTop - 12),
    behavior: 'smooth',
  })
}

const loadDetail = async (id: number, options?: { focusSection?: CustomerDetailFocusSection }) => {
  currentCustomerId.value = id
  detail.value = null
  loadError.value = ''
  activePanels.value = ['profile']
  resetForm()
  loading.value = true
  try {
    detail.value = await fetchCustomerDetail(id)
    resetForm()
    await scrollToSection(options?.focusSection)
  } catch (error: any) {
    detail.value = null
    loadError.value = getLoadErrorMessage(error)
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

const goToSection = async (section: CustomerDetailFocusSection) => {
  const panelName = panelSectionMap[section]
  if (!activePanels.value.includes(panelName)) {
    activePanels.value = [...activePanels.value, panelName]
  }
  await scrollToSection(section)
}

const submit = async () => {
  if (!currentCustomerId.value || !detail.value) {
    ElMessage.warning('请先加载客户详情')
    return
  }

  if (!form.content.trim()) {
    ElMessage.warning('请输入跟进内容')
    return
  }

  saving.value = true
  try {
    let nextDetail = await createCustomerFollow(currentCustomerId.value, {
      content: form.content.trim(),
      nextFollowTime: form.nextFollowTimeText || undefined,
    })

    if (form.status !== statusLabelToCode[detail.value.currentStatus]) {
      nextDetail = await updateCustomerStatus(currentCustomerId.value, { status: form.status })
    }

    detail.value = nextDetail
    loadError.value = ''
    ElMessage.success('客户跟进已保存')
    resetForm()
    emit('updated')
  } finally {
    saving.value = false
  }
}

const quickCreateRefund = async () => {
  if (!detail.value) {
    ElMessage.warning('请先加载客户详情')
    return
  }

  refundSubmitting.value = true
  refundDraft.value = {
    customerId: detail.value.id,
    customerName: detail.value.name,
    phone: detail.value.phone,
    sourceStage: 'CUSTOMER',
    firstSalesUserId: detail.value.firstSalesUserId,
    firstSalesUserName: detail.value.ownerChain.firstSalesUserName,
    reason: `客户在客户详情发起退款申请，当前状态：${detail.value.currentStatus}`,
    remark: detail.value.remark || '',
  }
  refundDialogVisible.value = true
  refundSubmitting.value = false
}

defineExpose({ loadDetail })
</script>

<template>
  <el-drawer v-model="visible" title="客户详情" size="70%" class="customer-detail-drawer">
    <div v-loading="loading" ref="drawerBodyRef" class="page-stack customer-detail-drawer-body">
      <template v-if="detail">
        <el-card>
          <div class="section-nav">
            <el-button text type="primary" @click="goToSection('sales-summary')">客户情况</el-button>
            <el-button text type="primary" @click="goToSection('prior-sales-evidence')">前序销售资料</el-button>
            <el-button text type="primary" @click="goToSection('legal')">法务信息</el-button>
            <el-button text type="primary" @click="goToSection('mediation')">调解信息</el-button>
          </div>
        </el-card>

        <el-collapse v-model="activePanels" class="customer-detail-collapse">
          <el-collapse-item name="profile">
            <template #title>客户档案</template>
            <el-card shadow="never">
              <template #header>
                <div class="card-header-row">
                  <span>客户档案</span>
                  <el-button type="danger" :loading="refundSubmitting" @click.stop="quickCreateRefund">申请退款</el-button>
                </div>
              </template>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="客户编号">{{ detail.customerNo }}</el-descriptions-item>
                <el-descriptions-item label="客户姓名">{{ detail.name }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ formatPhone(detail.phone, detail) }}</el-descriptions-item>
                <el-descriptions-item label="微信号">{{ detail.wechat || '-' }}</el-descriptions-item>
                <el-descriptions-item label="性别">{{ detail.gender || '-' }}</el-descriptions-item>
                <el-descriptions-item label="年龄">{{ detail.age ?? '-' }}</el-descriptions-item>
                <el-descriptions-item label="省份">{{ detail.province || '-' }}</el-descriptions-item>
                <el-descriptions-item label="城市">{{ detail.city || '-' }}</el-descriptions-item>
                <el-descriptions-item label="客户来源">{{ detail.source || '-' }}</el-descriptions-item>
                <el-descriptions-item label="意向等级">{{ detail.intentionLevel || '-' }}</el-descriptions-item>
                <el-descriptions-item label="案件类型">{{ detail.caseType || '-' }}</el-descriptions-item>
                <el-descriptions-item label="标的金额">{{ detail.targetAmount }}</el-descriptions-item>
                <el-descriptions-item label="当前状态"><el-tag>{{ detail.currentStatus }}</el-tag></el-descriptions-item>
                <el-descriptions-item label="尾款状态">{{ detail.isTailPaymentCompleted ? '已补齐' : '未补齐' }}</el-descriptions-item>
                <el-descriptions-item label="建档时间">{{ formatDateTime(detail.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="最后更新">{{ formatDateTime(detail.updatedAt) }}</el-descriptions-item>
                <el-descriptions-item label="备注" :span="2">{{ detail.remark || '-' }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-collapse-item>

          <el-collapse-item name="follow">
            <template #title>客户跟进处理</template>
            <el-card shadow="never">
              <el-alert
                :title="`当前跟进归属：${detail.followOwnerName || '-'} · ${detail.followStageLabel || '-'}，保存时将自动写入该阶段`"
                type="info"
                :closable="false"
                show-icon
              />
              <el-form label-width="110px" class="form-grid detail-form-block">
                <el-form-item label="当前状态">
                  <el-select v-model="form.status" placeholder="请选择当前状态">
                    <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="下次跟进时间">
                  <el-date-picker
                    v-model="form.nextFollowTimeText"
                    type="datetime"
                    value-format="YYYY-MM-DDTHH:mm:ss"
                    placeholder="请选择下次跟进时间"
                    style="width: 100%"
                  />
                </el-form-item>
                <el-form-item label="跟进内容" class="full-width">
                  <el-input v-model="form.content" type="textarea" :rows="4" placeholder="请输入客户跟进内容" />
                </el-form-item>
                <el-form-item class="full-width">
                  <el-button type="primary" :loading="saving" @click="submit">保存跟进</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-collapse-item>

          <el-collapse-item name="owners">
            <template #title>跟进负责人链路</template>
            <el-card shadow="never">
              <el-descriptions :column="5" border>
                <el-descriptions-item label="一销">{{ detail.ownerChain.firstSalesUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="一销团队">{{ detail.ownerChain.firstSalesTeamName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="二销">{{ detail.ownerChain.secondSalesUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="法务">{{ detail.ownerChain.legalUserName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="三销">{{ detail.ownerChain.thirdSalesUserName || '-' }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-collapse-item>

          <el-collapse-item name="payments">
            <template #title>付款汇总</template>
            <el-card shadow="never">
              <el-descriptions :column="5" border>
                <el-descriptions-item label="标的金额">{{ detail.paymentSummary.targetAmount }}</el-descriptions-item>
                <el-descriptions-item label="一销回款">{{ detail.paymentSummary.firstPaymentAmount }}</el-descriptions-item>
                <el-descriptions-item label="二销回款">{{ detail.paymentSummary.secondPaymentAmount }}</el-descriptions-item>
                <el-descriptions-item label="三销回款">{{ detail.paymentSummary.thirdPaymentAmount }}</el-descriptions-item>
                <el-descriptions-item label="总回款">{{ detail.paymentSummary.totalPaymentAmount }}</el-descriptions-item>
                <el-descriptions-item label="欠款金额">{{ detail.paymentSummary.arrearsAmount }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-collapse-item>

        <el-collapse-item name="sales-summary">
          <template #title>销售备注与客户情况</template>
          <el-card shadow="never">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="客户备注">{{ detail.salesSummary.customerRemark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="一销备注">{{ detail.salesSummary.firstSalesRemark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="二销备注">{{ detail.salesSummary.secondSalesRemark || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="prior-sales-evidence">
          <template #title>前序销售资料</template>
          <el-card shadow="never">
            <el-table v-if="detail.evidenceSummary.combinedForLegalAndThirdSales.length" :data="detail.evidenceSummary.combinedForLegalAndThirdSales">
              <el-table-column prop="label" label="资料类型" min-width="160" />
              <el-table-column label="来源阶段" min-width="120">
                <template #default="scope">
                  <el-tag :type="getEvidenceSourceTagType(scope.row.source)">{{ formatEvidenceSource(scope.row.source) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="附件" min-width="260">
                <template #default="scope">
                  <div v-if="isImageFile(scope.row.url)" class="thumbnail-cell">
                    <img
                      :src="toAbsoluteFileUrl(scope.row.url)"
                      :alt="scope.row.label"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.url, scope.row.label)"
                    />
                  </div>
                  <el-button v-else text type="primary" @click="openAttachmentPreview(scope.row.url, scope.row.label)">
                    {{ getFileName(scope.row.url) || scope.row.label }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无前序销售资料" />
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="all-evidence">
          <template #title>全链路证据</template>
          <el-card shadow="never">
            <el-table v-if="detail.evidenceSummary.combinedAll.length" :data="detail.evidenceSummary.combinedAll">
              <el-table-column prop="label" label="资料类型" min-width="160" />
              <el-table-column label="来源阶段" min-width="120">
                <template #default="scope">
                  <el-tag :type="getEvidenceSourceTagType(scope.row.source)">{{ formatEvidenceSource(scope.row.source) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="附件" min-width="260">
                <template #default="scope">
                  <div v-if="isImageFile(scope.row.url)" class="thumbnail-cell">
                    <img
                      :src="toAbsoluteFileUrl(scope.row.url)"
                      :alt="scope.row.label"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.url, scope.row.label)"
                    />
                  </div>
                  <el-button v-else text type="primary" @click="openAttachmentPreview(scope.row.url, scope.row.label)">
                    {{ getFileName(scope.row.url) || scope.row.label }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无全链路证据" />
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="legal">
          <template #title>法务信息</template>
          <el-card shadow="never">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="法务人员">{{ detail.legalCase?.legalUserName || detail.ownerChain.legalUserName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="处理进度">{{ detail.legalCase?.progressStatus || '-' }}</el-descriptions-item>
              <el-descriptions-item label="处理结果">{{ detail.legalCase?.caseResult || '-' }}</el-descriptions-item>
              <el-descriptions-item label="完成状态">{{ detail.legalCase ? (detail.legalCase.isCompleted ? '已完成' : '处理中') : '-' }}</el-descriptions-item>
              <el-descriptions-item label="立案成功">{{ detail.legalCase ? (detail.legalCase.filingApproved ? '是' : '否') : '-' }}</el-descriptions-item>
              <el-descriptions-item label="法务备注" :span="2">{{ detail.legalCase?.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="记录创建">{{ formatDateTime(detail.legalCase?.createdAt) }}</el-descriptions-item>
              <el-descriptions-item label="最近更新">{{ formatDateTime(detail.legalCase?.updatedAt) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="mediation">
          <template #title>调解信息</template>
          <el-card shadow="never">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="调解负责人">{{ detail.mediationCase?.ownerName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="调解进度">{{ detail.mediationCase?.progressStatus || '-' }}</el-descriptions-item>
              <el-descriptions-item label="调解结果">{{ detail.mediationCase?.mediationResult || '-' }}</el-descriptions-item>
              <el-descriptions-item label="完成时间">{{ formatDateTime(detail.mediationCase?.finishDate) }}</el-descriptions-item>
              <el-descriptions-item label="调解备注" :span="2">{{ detail.mediationCase?.remark || '-' }}</el-descriptions-item>
              <el-descriptions-item label="记录创建">{{ formatDateTime(detail.mediationCase?.createdAt) }}</el-descriptions-item>
              <el-descriptions-item label="最近更新">{{ formatDateTime(detail.mediationCase?.updatedAt) }}</el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="refunds">
          <template #title>退款记录</template>
          <el-card shadow="never">
            <el-table :data="detail.refundCases">
              <el-table-column prop="sourceStage" label="来源阶段" min-width="120" />
              <el-table-column prop="status" label="退款状态" min-width="120" />
              <el-table-column prop="requestedByName" label="申请人" min-width="120" />
              <el-table-column prop="reviewerName" label="审批人" min-width="120" />
              <el-table-column prop="assigneeName" label="处理人" min-width="120" />
              <el-table-column prop="reason" label="退款原因" min-width="220" show-overflow-tooltip />
              <el-table-column label="期望退款金额" min-width="140">
                <template #default="scope">{{ scope.row.expectedRefundAmount }}</template>
              </el-table-column>
              <el-table-column label="创建时间" min-width="180">
                <template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="approvals">
          <template #title>审批记录</template>
          <el-card shadow="never">
            <el-table :data="detail.approvals">
              <el-table-column label="类型" min-width="120">
                <template #default="scope">
                  {{ formatApprovalType(scope.row.approvalType) }}
                </template>
              </el-table-column>
              <el-table-column prop="title" label="标题" min-width="180" />
              <el-table-column label="状态" min-width="100">
                <template #default="scope">
                  {{ formatApprovalStatus(scope.row.status) }}
                </template>
              </el-table-column>
              <el-table-column prop="applicantName" label="申请人" min-width="120" />
              <el-table-column prop="approverName" label="审批人" min-width="120" />
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
              <el-table-column label="申请时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="quality">
          <template #title>质检记录</template>
          <el-card shadow="never">
            <el-table :data="detail.qualityRecords">
              <el-table-column prop="title" label="标题" min-width="180" />
              <el-table-column prop="inspectorName" label="质检人" min-width="120" />
              <el-table-column prop="score" label="评分" min-width="100" />
              <el-table-column prop="result" label="结果" min-width="120" />
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
              <el-table-column label="创建时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="first-sales">
          <template #title>一销记录</template>
          <el-card shadow="never">
            <el-table :data="detail.firstSalesOrders">
              <el-table-column prop="orderType" label="成交类型" min-width="100" />
              <el-table-column label="及时成交" min-width="100">
                <template #default="scope">
                  {{ scope.row.isTimelyDeal ? '是' : '否' }}
                </template>
              </el-table-column>
              <el-table-column prop="targetAmount" label="标的金额" min-width="120" />
              <el-table-column prop="contractAmount" label="合同金额" min-width="120" />
              <el-table-column prop="paymentAmount" label="付款金额" min-width="120" />
              <el-table-column prop="arrearsAmount" label="欠款金额" min-width="120" />
              <el-table-column prop="paymentSerialNo" label="付款单号" min-width="180" />
              <el-table-column label="付款截图" min-width="160">
                <template #default="scope">
                  <div v-if="scope.row.paymentScreenshotUrl" class="thumbnail-cell">
                    <img
                      :src="toAbsoluteFileUrl(scope.row.paymentScreenshotUrl)"
                      alt="付款截图"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.paymentScreenshotUrl, '付款截图')"
                    />
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="聊天记录" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.chatRecordUrl" class="evidence-grid">
                    <img
                      v-if="isImageFile(scope.row.chatRecordUrl)"
                      :src="toAbsoluteFileUrl(scope.row.chatRecordUrl)"
                      alt="聊天记录"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.chatRecordUrl, '聊天记录')"
                    />
                    <el-button v-else text class="file-chip" @click="openAttachmentPreview(scope.row.chatRecordUrl, '聊天记录')">
                      <el-icon><Document /></el-icon>
                      <span>{{ getFileName(scope.row.chatRecordUrl) }}</span>
                    </el-button>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="证据材料" min-width="240">
                <template #default="scope">
                  <div v-if="scope.row.evidenceImageUrls.length" class="evidence-grid">
                    <img
                      v-for="(item, index) in scope.row.evidenceImageUrls"
                      :key="`${scope.row.id}-${index}`"
                      :src="toAbsoluteFileUrl(item)"
                      :alt="`一销证据${index + 1}`"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(item, `一销证据${index + 1}`)"
                    />
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column prop="paymentStatus" label="付款状态" min-width="120" />
              <el-table-column label="合同" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.contractArchive" class="page-stack-sm">
                    <div>{{ scope.row.contractArchive.contractNo }}</div>
                    <el-button
                      v-if="scope.row.contractArchive.fileUrl"
                      text
                      type="primary"
                      @click="openAttachmentPreview(scope.row.contractArchive.fileUrl, scope.row.contractArchive.contractNo)"
                    >
                      查看合同
                    </el-button>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="录入时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="second-sales">
          <template #title>二销记录</template>
          <el-card shadow="never">
            <el-table :data="detail.secondSalesOrders">
              <el-table-column prop="secondPaymentAmount" label="付款金额" min-width="120" />
              <el-table-column label="包含开庭" min-width="100">
                <template #default="scope">{{ scope.row.includesHearing ? '是' : '否' }}</template>
              </el-table-column>
              <el-table-column prop="hearingCostAmount" label="开庭成本" min-width="120" />
              <el-table-column prop="performanceAmount" label="实际业绩" min-width="120" />
              <el-table-column prop="paymentSerialNo" label="付款单号" min-width="180" />
              <el-table-column label="付款截图" min-width="160">
                <template #default="scope">
                  <div v-if="scope.row.paymentScreenshotUrl" class="thumbnail-cell">
                    <img
                      :src="toAbsoluteFileUrl(scope.row.paymentScreenshotUrl)"
                      alt="付款截图"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.paymentScreenshotUrl, '付款截图')"
                    />
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="聊天记录截图" min-width="180">
                <template #default="scope">
                  <div v-if="scope.row.chatRecordUrl" class="thumbnail-cell">
                    <img
                      :src="toAbsoluteFileUrl(scope.row.chatRecordUrl)"
                      alt="聊天记录截图"
                      class="attachment-thumbnail"
                      @click="openAttachmentPreview(scope.row.chatRecordUrl, '聊天记录截图')"
                    />
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="证据收集" min-width="260">
                <template #default="scope">
                  <div v-if="scope.row.evidenceFileUrls.length" class="evidence-grid">
                    <template v-for="(item, index) in scope.row.evidenceFileUrls" :key="`${scope.row.id}-${index}`">
                      <img
                        v-if="isImageFile(item)"
                        :src="toAbsoluteFileUrl(item)"
                        :alt="`证据${index + 1}`"
                        class="attachment-thumbnail"
                        @click="openAttachmentPreview(item, `证据${index + 1}`)"
                      />
                      <el-button v-else text class="file-chip" @click="openAttachmentPreview(item, `证据${index + 1}`)">
                        <el-icon><Document /></el-icon>
                        <span>{{ getFileName(item) }}</span>
                      </el-button>
                    </template>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="合同" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.contractArchive" class="page-stack-sm">
                    <div>{{ scope.row.contractArchive.contractNo }}</div>
                    <el-button
                      v-if="scope.row.contractArchive.fileUrl"
                      text
                      type="primary"
                      @click="openAttachmentPreview(scope.row.contractArchive.fileUrl, scope.row.contractArchive.contractNo)"
                    >
                      查看合同
                    </el-button>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="录入时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.createdAt) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="third-sales">
          <template #title>三销记录</template>
          <el-card shadow="never">
            <el-table :data="detail.thirdSalesOrders">
              <el-table-column prop="thirdSalesUserName" label="三销人员" min-width="120" />
              <el-table-column prop="productName" label="服务项目" min-width="160" />
              <el-table-column prop="paymentAmount" label="本次回款" min-width="120" />
              <el-table-column prop="performanceAmount" label="业绩金额" min-width="120" />
              <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
              <el-table-column label="证据材料" min-width="240">
                <template #default="scope">
                  <div v-if="scope.row.evidenceFileUrls.length" class="evidence-grid">
                    <template v-for="(item, index) in scope.row.evidenceFileUrls" :key="`${scope.row.id}-${index}`">
                      <img
                        v-if="isImageFile(item)"
                        :src="toAbsoluteFileUrl(item)"
                        :alt="`三销证据${index + 1}`"
                        class="attachment-thumbnail"
                        @click="openAttachmentPreview(item, `三销证据${index + 1}`)"
                      />
                      <el-button v-else text class="file-chip" @click="openAttachmentPreview(item, `三销证据${index + 1}`)">
                        <el-icon><Document /></el-icon>
                        <span>{{ getFileName(item) }}</span>
                      </el-button>
                    </template>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="合同" min-width="220">
                <template #default="scope">
                  <div v-if="scope.row.contractArchive" class="page-stack-sm">
                    <div>{{ scope.row.contractArchive.contractNo }}</div>
                    <el-button
                      v-if="scope.row.contractArchive.fileUrl"
                      text
                      type="primary"
                      @click="openAttachmentPreview(scope.row.contractArchive.fileUrl, scope.row.contractArchive.contractNo)"
                    >
                      查看合同
                    </el-button>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="业务时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.orderDate) }}
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-collapse-item>

        <el-collapse-item name="follow-logs">
          <template #title>跟进日志</template>
          <el-card shadow="never">
            <div class="page-stack-sm">
              <el-card v-for="item in detail.followLogs" :key="item.id" shadow="never">
                <div class="page-stack-sm">
                  <div>{{ item.operatorName }} · {{ formatStage(item.stage) }}</div>
                  <div>{{ item.content }}</div>
                  <div>创建时间：{{ formatDateTime(item.createdAt) }}</div>
                  <div>下次跟进：{{ formatDateTime(item.nextFollowTime) }}</div>
                </div>
              </el-card>
            </div>
          </el-card>
        </el-collapse-item>
      </el-collapse>
      </template>
      <el-result v-else-if="loadError" icon="warning" title="客户详情加载失败" :sub-title="loadError">
        <template #extra>
          <el-button type="primary" :loading="loading" @click="currentCustomerId && loadDetail(currentCustomerId)">重试</el-button>
        </template>
      </el-result>
      <el-empty v-else description="请选择客户后查看详情" />
    </div>
    <el-dialog v-model="attachmentPreviewVisible" :title="attachmentPreviewTitle" width="800px">
      <div class="page-stack-sm">
        <img
          v-if="attachmentPreviewImageUrl && !attachmentPreviewFailed"
          :src="attachmentPreviewImageUrl"
          :alt="attachmentPreviewTitle"
          class="attachment-preview"
          @error="attachmentPreviewFailed = true"
        />
        <el-empty v-else-if="attachmentPreviewImageUrl && attachmentPreviewFailed" description="截图加载失败，请检查上传文件是否存在" />
        <iframe v-else-if="attachmentPreviewFileUrl" :src="attachmentPreviewFileUrl" class="attachment-file-frame" />
        <el-empty v-else description="暂无可预览附件" />
      </div>
    </el-dialog>
    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadDetail(currentCustomerId!)" />
  </el-drawer>
</template>

<style scoped>
.customer-detail-drawer-body {
  height: calc(100vh - 120px);
  overflow-y: auto;
  padding-right: 2px;
  min-width: 0;
  box-sizing: border-box;
}

.customer-detail-collapse {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.customer-detail-collapse :deep(.el-collapse-item__header) {
  padding: 0 16px;
  min-height: 52px;
  font-size: 18px;
  font-weight: 600;
  border: 1px solid #e7edf5;
  border-radius: 14px;
  background: #fff;
}

.customer-detail-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.customer-detail-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 0;
}

.customer-detail-collapse :deep(.el-collapse-item__content .el-card) {
  margin-top: 10px;
}

.detail-form-block {
  margin-top: 16px;
}

.customer-detail-drawer-body :deep(.el-card),
.customer-detail-drawer-body :deep(.el-descriptions),
.customer-detail-drawer-body :deep(.el-form),
.customer-detail-drawer-body :deep(.el-table),
.customer-detail-drawer-body :deep(.el-table__inner-wrapper),
.customer-detail-drawer-body :deep(.el-table__body-wrapper),
.customer-detail-drawer-body :deep(.el-scrollbar) {
  width: 100%;
  max-width: 100%;
}

.customer-detail-drawer-body :deep(.el-form-item__content),
.customer-detail-drawer-body :deep(.el-select),
.customer-detail-drawer-body :deep(.el-date-editor.el-input),
.customer-detail-drawer-body :deep(.el-date-editor.el-input__wrapper),
.customer-detail-drawer-body :deep(.el-input),
.customer-detail-drawer-body :deep(.el-textarea) {
  width: 100%;
}

.customer-detail-drawer-body :deep(.el-table .cell) {
  word-break: break-word;
}

.customer-detail-drawer-body :deep(.el-descriptions__body),
.customer-detail-drawer-body :deep(.el-descriptions__table) {
  width: 100%;
}

.section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.thumbnail-cell {
  display: flex;
  align-items: center;
}

.evidence-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-thumbnail {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
}

.attachment-preview {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: 0 auto;
  border-radius: 8px;
}

.attachment-file-frame {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: 8px;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
</style>
