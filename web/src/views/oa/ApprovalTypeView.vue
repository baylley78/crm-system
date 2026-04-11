<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { actionApproval, createApproval, fetchApprovals, payApproval } from '../../api/approvals'
import { authStorage } from '../../auth'
import { useAttachmentPreview } from '../../composables/useAttachmentPreview'
import { hasPermission } from '../../utils/permissions'
import type { ApprovalActionPayload, ApprovalCreatePayload, ApprovalListItem, ApprovalListResponse, ApprovalQueryParams } from '../../types'

const props = defineProps<{
  approvalType: 'REIMBURSEMENT' | 'LEAVE' | 'PUNCH_CARD'
  title: string
  showSummary?: boolean
}>()

const canCreateApproval = () => hasPermission('oa.approvals.create')
const canReviewApproval = () => hasPermission('oa.approvals.review')
const canPayApproval = () => hasPermission('oa.approvals.pay')

const loading = ref(false)
const saving = ref(false)
const actionSaving = ref(false)
const drawerVisible = ref(false)
const activeTab = ref<'my' | 'pending' | 'processed'>('my')
const reimbursementStatus = ref<'ALL' | 'PENDING' | 'PROCESSED' | 'UNPAID' | 'PAID'>('ALL')
const approvalData = ref<ApprovalListResponse>({
  myApplications: [],
  pendingApprovals: [],
  processedApprovals: [],
  allApplications: [],
  reimbursementItems: [],
})
const dialogVisible = ref(false)
const currentApproval = ref<ApprovalListItem | null>(null)
const dateRange = ref<[string, string] | []>([])
const quickRange = ref<'' | 'DAY' | 'WEEK' | 'MONTH'>('')
const {
  visible: attachmentPreviewVisible,
  title: attachmentPreviewTitle,
  imageUrl: attachmentPreviewImageUrl,
  fileUrl: attachmentPreviewFileUrl,
  hasImage: attachmentPreviewHasImage,
  hasFile: attachmentPreviewHasFile,
  openPreview: openAttachmentPreview,
  closePreview: closeAttachmentPreview,
} = useAttachmentPreview('凭证预览')
const form = reactive<ApprovalCreatePayload>({
  approvalType: props.approvalType,
  title: '',
  amount: 0,
  leaveDays: 0,
  punchDate: '',
  punchTime: '',
  reason: '',
  reimbursementAccountName: '',
  reimbursementPayeeName: '',
  reimbursementBankName: '',
  reimbursementCardNo: '',
  reimbursementVoucher: null,
  reimbursementVoucherUrl: '',
  remark: '',
})
const actionForm = reactive<ApprovalActionPayload>({
  action: 'APPROVE',
  remark: '',
})

const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'

const buildQueryParams = (): ApprovalQueryParams => ({
  approvalType: props.approvalType,
  ...(props.approvalType === 'REIMBURSEMENT' ? { statusView: reimbursementStatus.value } : {}),
  ...(dateRange.value.length === 2 ? { startDate: dateRange.value[0], endDate: dateRange.value[1] } : {}),
  ...(quickRange.value ? { quickRange: quickRange.value } : {}),
})

const loadApprovals = async () => {
  loading.value = true
  try {
    approvalData.value = await fetchApprovals(buildQueryParams())
  } finally {
    loading.value = false
  }
}

const currentList = computed(() => {
  if (props.approvalType === 'REIMBURSEMENT') {
    if (reimbursementStatus.value === 'PENDING') {
      return approvalData.value.pendingApprovals
    }
    if (reimbursementStatus.value === 'PROCESSED') {
      return approvalData.value.processedApprovals
    }
    return approvalData.value.reimbursementItems
  }

  if (activeTab.value === 'pending') {
    return approvalData.value.pendingApprovals
  }
  if (activeTab.value === 'processed') {
    return approvalData.value.processedApprovals
  }
  return approvalData.value.myApplications
})

const summary = computed(() => approvalData.value.summary)

const resetForm = () => {
  form.approvalType = props.approvalType
  form.title = ''
  form.amount = 0
  form.leaveDays = 0
  form.punchDate = ''
  form.punchTime = ''
  form.reason = ''
  form.reimbursementAccountName = ''
  form.reimbursementPayeeName = ''
  form.reimbursementBankName = ''
  form.reimbursementCardNo = ''
  form.reimbursementVoucher = null
  form.reimbursementVoucherUrl = ''
  form.remark = ''
}

watch(
  () => props.approvalType,
  () => {
    resetForm()
    reimbursementStatus.value = 'ALL'
    quickRange.value = ''
    dateRange.value = []
  },
)

const openActionDialog = (item: ApprovalListItem, action: ApprovalActionPayload['action']) => {
  currentApproval.value = item
  actionForm.action = action
  actionForm.remark = ''
  dialogVisible.value = true
}

const openPayDialog = (item: ApprovalListItem) => {
  currentApproval.value = item
  actionForm.action = 'APPROVE'
  actionForm.remark = ''
  dialogVisible.value = true
}

const closeActionDialog = () => {
  dialogVisible.value = false
  currentApproval.value = null
  actionForm.action = 'APPROVE'
  actionForm.remark = ''
}

const getErrorMessage = (error: any) => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) {
    return message.join('；')
  }
  if (typeof message === 'string' && message.trim()) {
    return message
  }
  return '操作失败'
}

const buildCreatePayload = (): ApprovalCreatePayload => {
  const payload: ApprovalCreatePayload = {
    approvalType: props.approvalType,
    title: form.title,
    reason: form.reason,
    remark: form.remark,
  }

  if (props.approvalType === 'REIMBURSEMENT') {
    payload.amount = form.amount
    payload.reimbursementAccountName = form.reimbursementAccountName?.trim()
    payload.reimbursementPayeeName = form.reimbursementPayeeName?.trim()
    payload.reimbursementBankName = form.reimbursementBankName?.trim()
    payload.reimbursementCardNo = form.reimbursementCardNo?.trim()
    payload.reimbursementVoucher = form.reimbursementVoucher || null
  } else if (props.approvalType === 'LEAVE') {
    payload.leaveDays = form.leaveDays
  } else {
    payload.punchDate = form.punchDate || undefined
    payload.punchTime = form.punchTime || undefined
  }

  return payload
}

const submit = async () => {
  if (!canCreateApproval()) {
    return
  }

  saving.value = true
  try {
    await createApproval(buildCreatePayload())
    ElMessage.success('审批申请已提交')
    resetForm()
    drawerVisible.value = false
    activeTab.value = 'my'
    await loadApprovals()
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

const submitAction = async () => {
  if (!currentApproval.value) {
    return
  }

  actionSaving.value = true
  try {
    if (props.approvalType === 'REIMBURSEMENT' && currentApproval.value.status === 'APPROVED' && currentApproval.value.paymentStatus === 'UNPAID' && canPayApproval()) {
      await payApproval(currentApproval.value.id, { remark: actionForm.remark })
      ElMessage.success('已标记为已打款')
    } else {
      await actionApproval(currentApproval.value.id, actionForm)
      ElMessage.success(actionForm.action === 'APPROVE' ? '审批已通过' : '审批已驳回')
    }
    closeActionDialog()
    await loadApprovals()
  } catch (error: any) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    actionSaving.value = false
  }
}

const formatApprovalType = (type: ApprovalListItem['approvalType']) => {
  if (type === 'REIMBURSEMENT') return '报销申请'
  if (type === 'LEAVE') return '请假申请'
  return '补卡申请'
}

const formatStatus = (item: ApprovalListItem) => {
  if (props.approvalType === 'REIMBURSEMENT' && item.status === 'APPROVED') {
    return item.paymentStatus === 'PAID' ? '已打款' : '待打款'
  }
  if (item.status === 'APPROVED') return '已通过'
  if (item.status === 'REJECTED') return '已驳回'
  return '待审批'
}

const formatStepStatus = (status: ApprovalListItem['steps'][number]['status']) => {
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return '待审批'
}

const formatStepSummary = (item: ApprovalListItem) => `${item.currentStep}/${item.maxStep}`

const setQuickRange = async (value: '' | 'DAY' | 'WEEK' | 'MONTH') => {
  quickRange.value = value
  if (value) {
    dateRange.value = []
  }
  await loadApprovals()
}

const openVoucherPreview = (url?: string) => {
  if (!url) {
    ElMessage.warning('凭证地址无效')
    return
  }
  openAttachmentPreview(url, '报销凭证')
}

const handleDateRangeChange = async () => {
  if (dateRange.value.length === 2) {
    quickRange.value = ''
  }
  await loadApprovals()
}

onMounted(loadApprovals)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="toolbar-row">
          <span>{{ title }}</span>
          <el-button v-if="canCreateApproval()" type="primary" @click="drawerVisible = true">发起</el-button>
        </div>
      </template>

      <div v-if="props.approvalType === 'REIMBURSEMENT'" class="approval-topbar">
        <div class="filter-stack">
          <el-space wrap>
            <el-button-group>
              <el-button :type="reimbursementStatus === 'ALL' ? 'primary' : 'default'" @click="reimbursementStatus = 'ALL'; loadApprovals()">全部</el-button>
              <el-button :type="reimbursementStatus === 'PENDING' ? 'primary' : 'default'" @click="reimbursementStatus = 'PENDING'; loadApprovals()">待审</el-button>
              <el-button :type="reimbursementStatus === 'PROCESSED' ? 'primary' : 'default'" @click="reimbursementStatus = 'PROCESSED'; loadApprovals()">已审</el-button>
              <el-button :type="reimbursementStatus === 'UNPAID' ? 'primary' : 'default'" @click="reimbursementStatus = 'UNPAID'; loadApprovals()">待打</el-button>
              <el-button :type="reimbursementStatus === 'PAID' ? 'primary' : 'default'" @click="reimbursementStatus = 'PAID'; loadApprovals()">已打</el-button>
            </el-button-group>
          </el-space>
          <el-space wrap>
            <el-button :type="quickRange === 'DAY' ? 'primary' : 'default'" @click="setQuickRange('DAY')">日</el-button>
            <el-button :type="quickRange === 'WEEK' ? 'primary' : 'default'" @click="setQuickRange('WEEK')">周</el-button>
            <el-button :type="quickRange === 'MONTH' ? 'primary' : 'default'" @click="setQuickRange('MONTH')">月</el-button>
            <el-button @click="setQuickRange('')">清空</el-button>
            <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" @change="handleDateRangeChange" />
          </el-space>
        </div>
        <div v-if="showSummary" class="stat-grid stat-grid-compact">
          <el-card shadow="hover"><div class="stat-label">已打款金额</div><div class="stat-value">{{ formatCurrency(summary?.paidAmount) }}</div></el-card>
          <el-card shadow="hover"><div class="stat-label">未打款金额</div><div class="stat-value">{{ formatCurrency(summary?.unpaidAmount) }}</div></el-card>
          <el-card shadow="hover"><div class="stat-label">总申请金额</div><div class="stat-value">{{ formatCurrency(summary?.totalAmount) }}</div></el-card>
        </div>
      </div>

      <el-card shadow="never">
        <template #header>审批列表</template>
        <el-tabs v-if="props.approvalType !== 'REIMBURSEMENT'" v-model="activeTab">
          <el-tab-pane label="我的" name="my" />
          <el-tab-pane label="待审" name="pending" />
          <el-tab-pane label="已审" name="processed" />
        </el-tabs>

        <el-table v-loading="loading" :data="currentList">
          <el-table-column label="申请人" prop="applicantName" min-width="120" />
          <el-table-column label="类型" min-width="120">
            <template #default="scope">{{ formatApprovalType(scope.row.approvalType) }}</template>
          </el-table-column>
          <el-table-column label="标题" prop="title" min-width="180" />
          <el-table-column v-if="props.approvalType === 'REIMBURSEMENT'" label="报销金额" min-width="120">
            <template #default="scope">{{ formatCurrency(scope.row.amount) }}</template>
          </el-table-column>
          <el-table-column v-if="props.approvalType === 'LEAVE'" label="请假天数" min-width="120">
            <template #default="scope">{{ scope.row.leaveDays || 0 }}</template>
          </el-table-column>
          <el-table-column v-if="props.approvalType === 'PUNCH_CARD'" label="补卡日期" min-width="120">
            <template #default="scope">{{ scope.row.punchDate?.slice(0, 10) || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="props.approvalType === 'PUNCH_CARD'" label="补卡时间" min-width="120">
            <template #default="scope">{{ scope.row.punchTime || '-' }}</template>
          </el-table-column>
          <el-table-column label="当前进度" min-width="100">
            <template #default="scope">{{ formatStepSummary(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="状态" min-width="100">
            <template #default="scope">{{ formatStatus(scope.row) }}</template>
          </el-table-column>
          <el-table-column v-if="props.approvalType === 'REIMBURSEMENT'" label="打款人" min-width="120">
            <template #default="scope">{{ scope.row.paidByName || '-' }}</template>
          </el-table-column>
          <el-table-column v-if="props.approvalType === 'REIMBURSEMENT'" label="打款时间" min-width="180">
            <template #default="scope">{{ formatDateTime(scope.row.paidAt) }}</template>
          </el-table-column>
          <el-table-column label="当前审批人" prop="approverName" min-width="120" />
          <el-table-column label="审批链" min-width="220">
            <template #default="scope">
              <div class="step-list">
                <div v-for="step in scope.row.steps" :key="step.step">{{ step.step }}级 {{ step.approverName }} / {{ formatStepStatus(step.status) }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" min-width="180">
            <template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="scope">
              <el-button v-if="scope.row.canApprove && canReviewApproval()" link type="primary" @click="openActionDialog(scope.row, 'APPROVE')">通过</el-button>
              <el-button v-if="scope.row.canApprove && canReviewApproval()" link type="danger" @click="openActionDialog(scope.row, 'REJECT')">驳回</el-button>
              <el-button v-if="props.approvalType === 'REIMBURSEMENT' && scope.row.reimbursementVoucherUrl" link type="primary" @click="openVoucherPreview(scope.row.reimbursementVoucherUrl)">凭证</el-button>
              <el-button v-if="props.approvalType === 'REIMBURSEMENT' && scope.row.status === 'APPROVED' && scope.row.paymentStatus === 'UNPAID' && canPayApproval()" link type="success" @click="openPayDialog(scope.row)">打款</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-card>

    <el-drawer v-model="drawerVisible" :title="`${title} - 发起申请`" size="520px">
      <el-form label-width="120px" class="page-stack">
        <div class="form-grid">
          <el-form-item label="申请标题">
            <el-input v-model="form.title" placeholder="请输入审批标题" />
          </el-form-item>
          <el-form-item v-if="props.approvalType === 'REIMBURSEMENT'" label="报销金额">
            <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
          </el-form-item>
          <template v-if="props.approvalType === 'REIMBURSEMENT'">
            <el-form-item label="申请人">
              <el-input :model-value="authStorage.getUser()?.realName || '-'" disabled />
            </el-form-item>
            <el-form-item label="申请时间">
              <el-input :model-value="new Date().toLocaleString('zh-CN')" disabled />
            </el-form-item>
            <el-form-item label="收款账户">
              <el-input v-model="form.reimbursementAccountName" placeholder="请输入收款账户" />
            </el-form-item>
            <el-form-item label="姓名">
              <el-input v-model="form.reimbursementPayeeName" placeholder="请输入姓名" />
            </el-form-item>
            <el-form-item label="开户行">
              <el-input v-model="form.reimbursementBankName" placeholder="请输入开户行" />
            </el-form-item>
            <el-form-item label="卡号">
              <el-input v-model="form.reimbursementCardNo" placeholder="请输入卡号" />
            </el-form-item>
            <el-form-item label="报销凭证" class="full-width">
              <el-upload :auto-upload="false" :limit="1" :show-file-list="true" :on-change="(file: any) => { form.reimbursementVoucher = file.raw || null }" :on-remove="() => { form.reimbursementVoucher = null }">
                <el-button>上传</el-button>
              </el-upload>
            </el-form-item>
          </template>
          <el-form-item v-else-if="props.approvalType === 'LEAVE'" label="请假天数">
            <el-input-number v-model="form.leaveDays" :min="0" :precision="1" style="width: 100%" />
          </el-form-item>
          <template v-else>
            <el-form-item label="补卡日期">
              <el-date-picker v-model="form.punchDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择补卡日期" style="width: 100%" />
            </el-form-item>
            <el-form-item label="补卡时间">
              <el-time-picker v-model="form.punchTime" value-format="HH:mm:ss" placeholder="请选择补卡时间" style="width: 100%" />
            </el-form-item>
          </template>
        </div>
        <el-form-item label="申请原因" class="full-width">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入申请原因" />
        </el-form-item>
        <el-form-item label="补充备注" class="full-width">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入补充备注" />
        </el-form-item>
        <el-form-item class="full-width drawer-actions">
          <el-button @click="resetForm">重置</el-button>
          <el-button type="primary" :loading="saving" @click="submit">提交</el-button>
        </el-form-item>
      </el-form>
    </el-drawer>

    <el-dialog v-model="attachmentPreviewVisible" :title="attachmentPreviewTitle" width="800px" @closed="closeAttachmentPreview">
      <div class="page-stack-sm">
        <img v-if="attachmentPreviewHasImage" :src="attachmentPreviewImageUrl" :alt="attachmentPreviewTitle" class="attachment-preview" />
        <iframe v-else-if="attachmentPreviewHasFile" :src="attachmentPreviewFileUrl" class="attachment-file-frame" />
        <el-empty v-else description="暂无可预览凭证" />
      </div>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="props.approvalType === 'REIMBURSEMENT' && currentApproval?.status === 'APPROVED' && currentApproval?.paymentStatus === 'UNPAID' && canPayApproval() ? '标记已打款' : actionForm.action === 'APPROVE' ? '通过审批' : '驳回审批'" width="520px">
      <el-form label-width="110px">
        <el-form-item label="申请标题">
          <div>{{ currentApproval?.title || '-' }}</div>
        </el-form-item>
        <el-form-item label="当前处理人">
          <div>{{ authStorage.getUser()?.realName || currentApproval?.approverName || '-' }}</div>
        </el-form-item>
        <el-form-item label="处理备注" class="full-width">
          <el-input v-model="actionForm.remark" type="textarea" :rows="3" placeholder="请输入处理备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeActionDialog">取消</el-button>
        <el-button type="primary" :loading="actionSaving" @click="submitAction">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.approval-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
}

.filter-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.stat-grid-compact {
  align-self: start;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.full-width {
  width: 100%;
}

.drawer-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.attachment-preview {
  width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.attachment-file-frame {
  width: 100%;
  height: 70vh;
  border: none;
}
</style>
