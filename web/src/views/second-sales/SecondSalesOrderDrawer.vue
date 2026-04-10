<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { authStorage } from '../../auth'
import { formatPhone, hasPermission } from '../../utils/permissions'
import { createSecondSalesOrder, fetchSecondSalesUsers, updateSecondSalesOrder } from '../../api/second-sales'
import { fetchPerformanceFormCustomerDetail } from '../../api/customers'
import { fetchPaymentAccountOptions } from '../../api/payment-accounts'
import { fetchCourtConfig } from '../../api/court-config'
import { getFileName, isImageFile, toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import type { CustomerDetail, PaymentAccountOption, SalesUserOption, SecondSalesAssignmentItem, SecondSalesOrderListItem, SecondSalesOrderPayload } from '../../types'

const canEditOrderTime = () => hasPermission('secondSales.time.edit')

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  updated: []
}>()

const users = ref<SalesUserOption[]>([])
const paymentAccounts = ref<PaymentAccountOption[]>([])
const loading = ref(false)
const currentCustomer = ref<SecondSalesAssignmentItem | null>(null)
const currentCustomerDetail = ref<CustomerDetail | null>(null)
const editingOrder = ref<SecondSalesOrderListItem | null>(null)
const paymentAmountText = ref('')
const paymentScreenshotList = ref<UploadFile[]>([])
const chatRecordFileList = ref<UploadFile[]>([])
const evidenceFileList = ref<UploadFile[]>([])
const paymentScreenshotPreviewUrl = ref('')
const chatRecordPreviewUrl = ref('')
const hearingCost = ref(0)

const initialForm = (): SecondSalesOrderPayload => ({
  phone: '',
  secondSalesUserId: undefined as unknown as number,
  orderType: 'FULL',
  contractAmount: 0,
  secondPaymentAmount: 0,
  includesHearing: false,
  paymentAccountId: undefined as unknown as number,
  paymentSerialNo: '',
  nextStage: 'LEGAL',
  orderDate: '',
  customerName: '',
  caseType: '',
  source: '',
  intentionLevel: '',
  remark: '',
  paymentScreenshot: null,
  chatRecordFile: null,
  evidenceFiles: [],
})

const form = reactive<SecondSalesOrderPayload>(initialForm())

const isEditMode = () => Boolean(editingOrder.value)

const actualPerformanceAmount = computed(() => {
  const paymentAmount = Number(paymentAmountText.value.trim() || 0)
  return Math.max(paymentAmount - (form.includesHearing ? hearingCost.value : 0), 0)
})

const orderTypeLabelMap = {
  DEPOSIT: '定金',
  TAIL: '尾款',
  FULL: '全款',
} as const

const requiresChatRecord = computed(() => form.orderType !== 'DEPOSIT')
const contractAmountText = computed({
  get: () => String(form.contractAmount || ''),
  set: (value: string) => {
    form.contractAmount = Number(value || 0)
  },
})

const isPendingStatus = (status: string) => status === '待分配二销' || status === 'PENDING_SECOND_SALES_ASSIGNMENT'
const formatStatus = (status: string) => {
  if (isPendingStatus(status)) {
    return '待分配二销'
  }
  if (status === '二销跟进中' || status === 'SECOND_SALES_FOLLOWING') {
    return '二销跟进中'
  }
  return status
}

const upstreamSituationRemark = computed(() => currentCustomerDetail.value?.salesSummary.firstSalesRemark || currentCustomerDetail.value?.salesSummary.customerRemark || currentCustomer.value?.firstSalesRemark || currentCustomer.value?.remark || '')
const upstreamEvidence = computed(() => currentCustomerDetail.value?.evidenceSummary.combinedForSecondSales || currentCustomer.value?.firstSalesEvidence || [])

const openAttachment = (url?: string) => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    ElMessage.warning('附件地址无效')
    return
  }
  window.open(absoluteUrl, '_blank', 'noopener')
}

const assignDefaultSecondSalesUser = () => {
  const currentUser = authStorage.getUser()
  const preferredId = currentCustomer.value?.secondSalesUserName ? users.value.find((item) => item.realName === currentCustomer.value?.secondSalesUserName)?.id : undefined
  const currentUserId = currentUser?.id
  form.secondSalesUserId = preferredId || currentUserId || users.value[0]?.id || undefined
}

const resetForm = () => {
  editingOrder.value = null
  Object.assign(form, initialForm())
  paymentAmountText.value = ''
  paymentScreenshotList.value = []
  chatRecordFileList.value = []
  evidenceFileList.value = []
  paymentScreenshotPreviewUrl.value = ''
  chatRecordPreviewUrl.value = ''
  if (currentCustomer.value) {
    form.phone = currentCustomer.value.phone
    form.customerName = currentCustomer.value.name
  }
  assignDefaultSecondSalesUser()
}

const fillFormForEdit = (order: SecondSalesOrderListItem) => {
  editingOrder.value = order
  currentCustomer.value = {
    id: order.customerId,
    customerNo: order.customerNo,
    name: order.customerName,
    phone: order.phone,
    firstPaymentAmount: 0,
    arrearsAmount: 0,
    currentStatus: '二销跟进中',
    secondSalesUserName: order.secondSalesUserName,
  }
  form.phone = order.phone
  form.customerName = order.customerName
  form.secondSalesUserId = order.secondSalesUserId || users.value.find((item) => item.realName === order.secondSalesUserName)?.id || authStorage.getUser()?.id || users.value[0]?.id || undefined
  form.orderType = (order.orderType === '定金' ? 'DEPOSIT' : order.orderType === '尾款' ? 'TAIL' : 'FULL')
  form.contractAmount = order.contractAmount
  form.secondPaymentAmount = order.secondPaymentAmount
  form.includesHearing = order.includesHearing
  form.paymentAccountId = order.paymentAccountId || paymentAccounts.value[0]?.id || undefined
  form.paymentSerialNo = order.paymentSerialNo || ''
  form.nextStage = order.currentStatus === 'PENDING_THIRD_SALES' ? 'THIRD_SALES' : 'LEGAL'
  form.orderDate = order.orderDate ? order.orderDate.slice(0, 16) : ''
  form.caseType = ''
  form.source = ''
  form.intentionLevel = ''
  form.remark = ''
  form.paymentScreenshot = null
  form.chatRecordFile = null
  form.evidenceFiles = []
  paymentAmountText.value = String(order.secondPaymentAmount || 0)
  paymentScreenshotPreviewUrl.value = order.paymentScreenshotUrl || ''
  chatRecordPreviewUrl.value = order.chatRecordUrl || ''
  paymentScreenshotList.value = order.paymentScreenshotUrl
    ? [
        {
          name: '当前付款截图',
          url: order.paymentScreenshotUrl,
        } as UploadFile,
      ]
    : []
  chatRecordFileList.value = order.chatRecordUrl
    ? [
        {
          name: '当前聊天记录',
          url: order.chatRecordUrl,
        } as UploadFile,
      ]
    : []
  evidenceFileList.value = order.evidenceFileUrls.map((url, index) => ({
    name: `当前证据${index + 1}`,
    url,
  }) as UploadFile)
}

const loadUsers = async () => {
  const [paymentAccountsResult, courtConfigResult, userListResult] = await Promise.allSettled([
    fetchPaymentAccountOptions(),
    fetchCourtConfig().catch(() => ({ hearingCost: 0 })),
    fetchSecondSalesUsers(),
  ])

  paymentAccounts.value = paymentAccountsResult.status === 'fulfilled' ? paymentAccountsResult.value : []
  hearingCost.value = courtConfigResult.status === 'fulfilled' ? courtConfigResult.value.hearingCost || 0 : 0
  users.value = userListResult.status === 'fulfilled' ? userListResult.value : []

  assignDefaultSecondSalesUser()

  if (!form.paymentAccountId) {
    form.paymentAccountId = paymentAccounts.value[0]?.id || undefined
  }

  if (paymentAccountsResult.status === 'rejected') {
    ElMessage.error(paymentAccountsResult.reason?.response?.data?.message || paymentAccountsResult.reason?.message || '收款账户加载失败，请刷新后重试')
  } else if (!paymentAccounts.value.length) {
    ElMessage.warning('暂无可用收款账户，请联系管理员先启用收款账户')
  }

  if (userListResult.status === 'rejected') {
    ElMessage.error(userListResult.reason?.response?.data?.message || userListResult.reason?.message || '二销人员加载失败，请刷新后重试')
  }

  if (courtConfigResult.status === 'rejected') {
    ElMessage.warning('开庭成本配置暂无权限读取，已按 0 处理')
  }
}

const openForCustomer = async (customer: SecondSalesAssignmentItem) => {
  editingOrder.value = null
  currentCustomer.value = customer
  currentCustomerDetail.value = null
  visible.value = true
  resetForm()

  if (!paymentAccounts.value.length || !users.value.length) {
    await loadUsers()
  }

  try {
    currentCustomerDetail.value = await fetchPerformanceFormCustomerDetail(customer.id)
    return
  } catch (error: any) {
    ElMessage.warning(error?.response?.data?.message || error?.message || '客户详情读取失败，已使用列表信息继续录单')
  }

  currentCustomerDetail.value = null
}

const openForEdit = async (order: SecondSalesOrderListItem) => {
  if (!users.value.length || !paymentAccounts.value.length) {
    await loadUsers()
  }
  fillFormForEdit(order)
  visible.value = true
}

const openForTailPayment = async (order: SecondSalesOrderListItem, payload: SecondSalesOrderPayload) => {
  if (!users.value.length || !paymentAccounts.value.length) {
    await loadUsers()
  }
  fillFormForEdit(order)
  form.orderType = payload.orderType
  form.contractAmount = payload.contractAmount
  form.secondPaymentAmount = payload.secondPaymentAmount
  form.includesHearing = order.includesHearing
  paymentAmountText.value = String(payload.secondPaymentAmount || 0)
  form.paymentSerialNo = payload.paymentSerialNo
  form.nextStage = payload.nextStage
  form.remark = payload.remark || ''
  form.paymentScreenshot = null
  form.chatRecordFile = null
  form.evidenceFiles = []
  paymentScreenshotList.value = []
  chatRecordFileList.value = []
  evidenceFileList.value = []
  paymentScreenshotPreviewUrl.value = ''
  chatRecordPreviewUrl.value = ''
  visible.value = true
}

const handlePaymentScreenshotChange = (file: { raw?: File }) => {
  form.paymentScreenshot = file.raw || null
  paymentScreenshotPreviewUrl.value = file.raw ? URL.createObjectURL(file.raw) : ''
  paymentScreenshotList.value = file.raw
    ? [
        {
          name: file.raw.name,
          url: paymentScreenshotPreviewUrl.value,
        } as UploadFile,
      ]
    : []
}

const handleChatRecordChange = (file: { raw?: File }) => {
  form.chatRecordFile = file.raw || null
  chatRecordPreviewUrl.value = file.raw ? URL.createObjectURL(file.raw) : ''
  chatRecordFileList.value = file.raw
    ? [
        {
          name: file.raw.name,
          url: chatRecordPreviewUrl.value,
        } as UploadFile,
      ]
    : []
}

const handlePaymentScreenshotRemove = () => {
  form.paymentScreenshot = null
  paymentScreenshotList.value = []
  paymentScreenshotPreviewUrl.value = ''
}

const handleChatRecordRemove = () => {
  form.chatRecordFile = null
  chatRecordFileList.value = []
  chatRecordPreviewUrl.value = ''
}

const syncEvidenceFiles = (fileList: UploadFile[]) => {
  evidenceFileList.value = fileList
  form.evidenceFiles = fileList.reduce<File[]>((files, item) => {
    if (item.raw) {
      files.push(item.raw as File)
    }
    return files
  }, [])
}

const handleEvidenceFilesChange = (_: UploadFile, fileList: UploadFile[]) => {
  syncEvidenceFiles(fileList)
}

const handleEvidenceFilesRemove = (_: UploadFile, fileList: UploadFile[]) => {
  syncEvidenceFiles(fileList)
}

const handleEvidenceFilesExceed = () => {
  ElMessage.warning('证据文件最多上传 20 个')
}

const handlePasteFile = (event: ClipboardEvent, field: 'paymentScreenshot' | 'chatRecordFile') => {
  const imageFile = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .find(Boolean)

  if (!imageFile) {
    ElMessage.warning('请先复制图片，再粘贴到这里')
    return
  }

  const file = new File([imageFile], imageFile.name || `${field}-${Date.now()}.png`, { type: imageFile.type || 'image/png' })

  if (field === 'paymentScreenshot') {
    handlePaymentScreenshotChange({ raw: file })
    ElMessage.success('付款截图已粘贴')
    return
  }

  handleChatRecordChange({ raw: file })
  ElMessage.success('聊天截图已粘贴')
}

const handlePaymentScreenshotPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  handlePasteFile(event, 'paymentScreenshot')
}

const handleChatRecordPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  handlePasteFile(event, 'chatRecordFile')
}

const handleEvidenceFilesPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedFiles = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile())
    .filter((item): item is File => Boolean(item))

  if (!pastedFiles.length) {
    ElMessage.warning('请先复制图片或文件，再粘贴到证据栏')
    return
  }

  const remain = 20 - evidenceFileList.value.length
  if (remain <= 0) {
    ElMessage.warning('证据文件最多上传 20 个')
    return
  }

  const nextFiles = pastedFiles.slice(0, remain)
  const nextList = [
    ...evidenceFileList.value,
    ...nextFiles.map((file) =>
      ({
        name: file.name || `evidence-${Date.now()}`,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        raw: file,
      }) as UploadFile,
    ),
  ]
  syncEvidenceFiles(nextList)

  if (pastedFiles.length > remain) {
    ElMessage.warning('超出部分未添加，证据文件最多上传 20 个')
    return
  }

  ElMessage.success(`已粘贴 ${nextFiles.length} 个证据文件`)
}

const submit = async () => {
  if (!form.phone.trim()) {
    ElMessage.warning('请输入客户手机号')
    return
  }

  if (!currentCustomer.value) {
    ElMessage.warning('请从已有一销客户进入二销录单')
    return
  }

  if (!form.secondSalesUserId) {
    ElMessage.warning('请选择二销人员')
    return
  }

  if (!form.paymentAccountId) {
    ElMessage.warning('请选择收款账户')
    return
  }

  const parsedPaymentAmount = Number(paymentAmountText.value.trim())
  if (!paymentAmountText.value.trim() || Number.isNaN(parsedPaymentAmount) || parsedPaymentAmount < 0) {
    ElMessage.warning('请输入正确的付款金额')
    return
  }

  if (Number.isNaN(Number(form.contractAmount)) || Number(form.contractAmount) <= 0) {
    ElMessage.warning('请输入正确的应收金额')
    return
  }

  form.secondPaymentAmount = parsedPaymentAmount

  if (!form.paymentSerialNo.trim()) {
    ElMessage.warning('请输入付款单号')
    return
  }

  if (!form.paymentScreenshot && !isEditMode()) {
    ElMessage.warning('请上传付款截图')
    return
  }

  if (requiresChatRecord.value && !form.chatRecordFile && !isEditMode()) {
    ElMessage.warning('尾款或全款必须上传聊天记录截图')
    return
  }

  loading.value = true
  try {
    const payload = {
      ...form,
      phone: form.phone.trim(),
      customerName: form.customerName?.trim(),
      caseType: form.caseType?.trim(),
      source: form.source?.trim(),
      intentionLevel: form.intentionLevel?.trim(),
      remark: form.remark?.trim(),
    }

    if (editingOrder.value) {
      await updateSecondSalesOrder(editingOrder.value.id, payload)
      ElMessage.success('二销业绩已更新')
      visible.value = false
      emit('updated')
      return
    }

    await createSecondSalesOrder(payload)
    ElMessage.success('二销业绩已保存并完成流转')
    visible.value = false
    emit('updated')
  } finally {
    loading.value = false
  }
}

watch(visible, (value) => {
  if (!value && !loading.value) {
    currentCustomer.value = null
    currentCustomerDetail.value = null
    editingOrder.value = null
    Object.assign(form, initialForm())
    paymentAmountText.value = ''
    paymentScreenshotList.value = []
    chatRecordFileList.value = []
    evidenceFileList.value = []
    paymentScreenshotPreviewUrl.value = ''
    chatRecordPreviewUrl.value = ''
  }
})

defineExpose({ openForCustomer, openForEdit, openForTailPayment })
</script>

<template>
  <el-drawer v-model="visible" :title="isEditMode() ? '编辑二销业绩' : '录入二销业绩'" size="620px">
    <div class="page-stack drawer-body">
      <el-card shadow="never" class="summary-card">
        <template #header>
          <div class="section-title">客户信息</div>
        </template>
        <div v-if="currentCustomer" class="customer-summary-grid">
          <div class="summary-item">
            <span class="summary-label">客户姓名</span>
            <span class="summary-value">{{ currentCustomer?.name || '-' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">手机号码</span>
            <span class="summary-value">{{ formatPhone(currentCustomer?.phone, currentCustomer || undefined) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">一销金额</span>
            <span class="summary-value">{{ currentCustomer?.firstPaymentAmount ?? 0 }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">当前状态</span>
            <span class="summary-value">{{ currentCustomer ? formatStatus(currentCustomer.currentStatus) : '-' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">二销所属人</span>
            <span class="summary-value">{{ currentCustomer?.secondSalesUserName || '-' }}</span>
          </div>
          <div class="summary-item summary-item-wide">
            <span class="summary-label">一销客户情况说明</span>
            <span class="summary-value">{{ upstreamSituationRemark || '-' }}</span>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card">
        <template #header>
          <div class="section-title">上游证据</div>
        </template>
        <div v-if="upstreamEvidence.length" class="evidence-preview-grid">
          <div v-for="(item, index) in upstreamEvidence" :key="`${item.url}-${index}`" class="evidence-preview-item">
            <div class="summary-label">{{ item.label }}</div>
            <img v-if="isImageFile(item.url)" :src="toAbsoluteFileUrl(item.url)" :alt="item.label" class="evidence-preview-image" @click="openAttachment(item.url)" />
            <el-button v-else text type="primary" class="evidence-link" @click="openAttachment(item.url)">
              <el-icon><Document /></el-icon>
              <span>{{ getFileName(item.url) || item.label }}</span>
            </el-button>
          </div>
        </div>
        <el-empty v-else description="暂无一销证据" />
      </el-card>

      <el-card shadow="never" class="form-card">
        <template #header>
          <div class="section-title">业绩信息</div>
        </template>
        <el-alert :title="isEditMode() ? '编辑时如不重新上传文件，将保留当前截图与证据' : '仅支持基于已有一销客户录入二销业绩；截图可直接 Ctrl+V 粘贴。'" type="info" :closable="false" show-icon />

        <el-form label-position="top" class="page-stack form-stack">
          <div class="form-grid compact-grid">
            <el-form-item label="二销人员">
              <el-select v-model="form.secondSalesUserId" placeholder="请选择二销人员" clearable>
                <el-option v-if="!users.length && authStorage.getUser()?.id" :label="authStorage.getUser()?.realName || '当前登录人'" :value="authStorage.getUser()!.id" />
                <el-option v-for="item in users" :key="item.id" :label="item.realName" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="订单类型">
              <el-radio-group v-model="form.orderType">
                <el-radio value="DEPOSIT">定金</el-radio>
                <el-radio value="TAIL">尾款</el-radio>
                <el-radio value="FULL">全款</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="应收金额">
              <el-input v-model="contractAmountText" placeholder="请输入应收金额" clearable />
            </el-form-item>
            <el-form-item label="本次付款金额">
              <el-input v-model="paymentAmountText" placeholder="请输入本次付款金额" clearable />
            </el-form-item>
            <el-form-item label="是否包含开庭">
              <el-switch v-model="form.includesHearing" />
            </el-form-item>
          </div>

          <div class="form-grid compact-grid">
            <el-form-item label="开庭成本">
              <el-input :model-value="form.includesHearing ? String(hearingCost) : '0'" disabled />
            </el-form-item>
            <el-form-item label="剩余欠款">
              <el-input :model-value="String(Math.max(Number(form.contractAmount || 0) - Number(paymentAmountText || 0), 0))" disabled />
            </el-form-item>
            <el-form-item label="实际业绩">
              <el-input :model-value="String(actualPerformanceAmount)" disabled />
            </el-form-item>
          </div>

          <el-form-item label="收款账户">
            <el-select v-model="form.paymentAccountId" placeholder="请选择收款账户" filterable clearable>
              <el-option v-for="item in paymentAccounts" :key="item.id" :label="`${item.accountName}（${item.accountNo}）`" :value="item.id" />
            </el-select>
          </el-form-item>

          <el-form-item label="付款单号">
            <el-input v-model="form.paymentSerialNo" placeholder="请输入付款单号" clearable />
          </el-form-item>

          <el-form-item label="成功后流转">
            <el-radio-group v-model="form.nextStage" :disabled="form.orderType === 'DEPOSIT'">
              <el-radio value="LEGAL">转法务</el-radio>
              <el-radio value="THIRD_SALES">转三销</el-radio>
            </el-radio-group>
            <div class="upload-tip">{{ form.orderType === 'DEPOSIT' ? '定金单不提前流转，待后续补尾款后再流转。' : `当前为${orderTypeLabelMap[form.orderType]}单，保存后按所选节点流转。` }}</div>
          </el-form-item>

          <el-form-item v-if="canEditOrderTime()" label="录单时间">
            <el-date-picker v-model="form.orderDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择录单时间" style="width: 100%" />
          </el-form-item>

          <el-form-item label="客户情况说明">
            <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入客户情况说明" />
          </el-form-item>

          <div class="upload-grid">
            <el-form-item label="付款截图" class="upload-item">
              <div class="page-stack-sm full-width upload-panel card-like-panel">
                <div class="paste-upload-box" tabindex="0" @paste="handlePaymentScreenshotPaste">
                  复制截图后，在这里按 Ctrl+V 粘贴付款截图
                </div>
                <img v-if="paymentScreenshotPreviewUrl" :src="paymentScreenshotPreviewUrl" alt="付款截图预览" class="paste-image-preview" />
                <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前付款截图</div>
                <el-upload
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :file-list="paymentScreenshotList"
                  :on-change="handlePaymentScreenshotChange"
                  :on-remove="handlePaymentScreenshotRemove"
                >
                  <el-button>选择付款截图</el-button>
                </el-upload>
              </div>
            </el-form-item>

            <el-form-item :label="requiresChatRecord ? '聊天记录截图（必传）' : '聊天记录截图（定金可不传）'" class="upload-item">
              <div class="page-stack-sm full-width upload-panel card-like-panel">
                <div class="paste-upload-box" tabindex="0" @paste="handleChatRecordPaste">
                  {{ requiresChatRecord ? '复制聊天截图后，在这里按 Ctrl+V 直接粘贴（尾款/全款必传）' : '当前为定金单，聊天截图可先不上传；如已复制也可直接粘贴' }}
                </div>
                <img v-if="chatRecordPreviewUrl" :src="chatRecordPreviewUrl" alt="聊天截图预览" class="paste-image-preview" />
                <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前聊天记录</div>
                <el-upload
                  :auto-upload="false"
                  :show-file-list="true"
                  :limit="1"
                  :file-list="chatRecordFileList"
                  :on-change="handleChatRecordChange"
                  :on-remove="handleChatRecordRemove"
                >
                  <el-button>上传聊天记录截图</el-button>
                </el-upload>
              </div>
            </el-form-item>
          </div>

          <el-form-item label="证据收集" class="upload-item full-width">
            <div class="page-stack-sm full-width upload-panel card-like-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handleEvidenceFilesPaste">
                复制证据截图或文件后，在这里按 Ctrl+V 可直接粘贴
              </div>
              <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前证据文件</div>
              <el-upload
                :auto-upload="false"
                :show-file-list="true"
                :file-list="evidenceFileList"
                multiple
                :limit="20"
                :on-change="handleEvidenceFilesChange"
                :on-remove="handleEvidenceFilesRemove"
                :on-exceed="handleEvidenceFilesExceed"
              >
                <el-button>上传证据截图或文件</el-button>
              </el-upload>
            </div>
          </el-form-item>

          <el-form-item class="full-width form-actions">
            <el-button type="primary" size="large" :loading="loading" @click="submit">{{ isEditMode() ? '保存修改' : '保存并流转' }}</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body {
  padding-bottom: 8px;
}

.summary-card,
.form-card {
  border-radius: 12px;
}

.section-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.customer-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.summary-item-wide {
  grid-column: 1 / -1;
}

.summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.summary-value {
  color: var(--el-text-color-primary);
  word-break: break-all;
}

.form-stack {
  margin-top: 16px;
}

.evidence-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.evidence-preview-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.evidence-preview-image {
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

.upload-item {
  margin-bottom: 0;
}

.upload-panel {
  width: 100%;
}

.card-like-panel {
  padding: 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.paste-upload-box {
  padding: 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  background: #fff;
  outline: none;
}

.paste-upload-box:focus {
  border-color: var(--el-color-primary);
}

.paste-image-preview {
  display: block;
  max-width: 100%;
  max-height: 220px;
  margin: 0 auto;
  border-radius: 8px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.form-actions {
  margin-top: 8px;
}

.full-width {
  width: 100%;
}
</style>
