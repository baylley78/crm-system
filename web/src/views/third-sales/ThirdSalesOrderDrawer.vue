<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { authStorage } from '../../auth'
import { formatPhone, hasPermission } from '../../utils/permissions'
import { createThirdSalesOrder, fetchThirdSalesUsers, updateThirdSalesOrder } from '../../api/third-sales'
import { fetchPaymentAccountOptions } from '../../api/payment-accounts'
import { fetchCourtConfig } from '../../api/court-config'
import type { PaymentAccountOption, SalesUserOption, ThirdSalesCustomerSearchResult, ThirdSalesOrderListItem, ThirdSalesOrderPayload } from '../../types'

const canEditOrderTime = () => hasPermission('thirdSales.time.edit')

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  updated: []
}>()

const users = ref<SalesUserOption[]>([])
const paymentAccounts = ref<PaymentAccountOption[]>([])
const loading = ref(false)
const currentCustomer = ref<ThirdSalesCustomerSearchResult | null>(null)
const editingOrder = ref<ThirdSalesOrderListItem | null>(null)
const evidenceFileList = ref<UploadFile[]>([])
const paymentScreenshotList = ref<UploadFile[]>([])
const chatRecordFileList = ref<UploadFile[]>([])
const paymentScreenshotPreviewUrl = ref('')
const chatRecordPreviewUrl = ref('')
const hearingCost = ref(0)

const initialForm = (): ThirdSalesOrderPayload => ({
  phone: '',
  thirdSalesUserId: 0,
  orderType: 'FULL',
  productName: '',
  paymentAmount: '',
  contractAmount: '',
  paymentAccountId: 0,
  paymentSerialNo: '',
  orderDate: '',
  paymentScreenshot: null,
  customerName: '',
  caseType: '',
  source: '',
  intentionLevel: '',
  remark: '',
  evidenceFiles: [],
  chatRecordFile: null,
})

const form = reactive<ThirdSalesOrderPayload>(initialForm())

const isEditMode = () => Boolean(editingOrder.value)

const actualPerformanceAmount = computed(() => {
  const payment = Number(form.paymentAmount || 0)
  return Math.max(payment - hearingCost.value, 0)
})

const requiresChatRecord = computed(() => form.orderType !== 'DEPOSIT')

const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const sourceStageLabel = (value?: ThirdSalesCustomerSearchResult['thirdSalesSourceStage']) => {
  if (value === 'SECOND_SALES') {
    return '来自二销'
  }
  if (value === 'LEGAL') {
    return '来自法务'
  }
  return '-'
}

const assignDefaultThirdSalesUser = () => {
  const currentUser = authStorage.getUser()
  const preferredId = currentCustomer.value?.thirdSalesUserName ? users.value.find((item) => item.realName === currentCustomer.value?.thirdSalesUserName)?.id : undefined
  const currentUserId = users.value.find((item) => item.id === currentUser?.id)?.id
  form.thirdSalesUserId = preferredId || currentUserId || users.value[0]?.id || 0
}

const resetForm = () => {
  editingOrder.value = null
  Object.assign(form, initialForm())
  evidenceFileList.value = []
  paymentScreenshotList.value = []
  chatRecordFileList.value = []
  paymentScreenshotPreviewUrl.value = ''
  chatRecordPreviewUrl.value = ''
  if (currentCustomer.value?.phone) {
    form.phone = currentCustomer.value.phone
    form.customerName = currentCustomer.value.name
    form.caseType = currentCustomer.value.caseType || ''
    form.source = currentCustomer.value.source || ''
    form.intentionLevel = currentCustomer.value.intentionLevel || ''
  }
  assignDefaultThirdSalesUser()
}

const fillFormForEdit = (order: ThirdSalesOrderListItem) => {
  editingOrder.value = order
  currentCustomer.value = {
    id: order.customerId,
    customerNo: order.customerNo,
    name: order.customerName,
    phone: order.phone,
    currentStatus: '三销开发中',
    thirdSalesUserName: order.thirdSalesUserName,
    thirdSalesSourceStage: order.sourceStage,
    firstPaymentAmount: 0,
    secondPaymentAmount: 0,
    thirdPaymentAmount: order.paymentAmount,
    totalPaymentAmount: order.paymentAmount,
    arrearsAmount: 0,
  }
  form.phone = order.phone
  form.customerName = order.customerName
  form.thirdSalesUserId = order.thirdSalesUserId || users.value.find((item) => item.realName === order.thirdSalesUserName)?.id || users.value[0]?.id || 0
  form.orderType = (order.orderType === '定金' ? 'DEPOSIT' : order.orderType === '尾款' ? 'TAIL' : 'FULL')
  form.productName = order.productName
  form.paymentAmount = String(order.paymentAmount || '')
  form.contractAmount = String(order.contractAmount || '')
  form.paymentAccountId = order.paymentAccountId || paymentAccounts.value[0]?.id || 0
  form.paymentSerialNo = order.paymentSerialNo || ''
  form.orderDate = order.orderDate ? order.orderDate.slice(0, 16) : ''
  form.paymentScreenshot = null
  form.caseType = ''
  form.source = ''
  form.intentionLevel = ''
  form.remark = order.remark || ''
  form.chatRecordFile = null
  form.evidenceFiles = []
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
  const [paymentAccountList, courtConfig, userList] = await Promise.all([
    fetchPaymentAccountOptions(),
    fetchCourtConfig().catch(() => ({ hearingCost: 0 })),
    fetchThirdSalesUsers(),
  ])
  users.value = userList
  paymentAccounts.value = paymentAccountList
  hearingCost.value = courtConfig.hearingCost || 0
  assignDefaultThirdSalesUser()
  if (!form.paymentAccountId) {
    form.paymentAccountId = paymentAccounts.value[0]?.id || 0
  }
}

const openForCustomer = async (customer?: ThirdSalesCustomerSearchResult | null, phone?: string) => {
  editingOrder.value = null
  currentCustomer.value = customer || null
  visible.value = true
  resetForm()
  if (!form.phone && phone?.trim()) {
    form.phone = phone.trim()
  }
  await loadUsers()
}

const openForEdit = async (order: ThirdSalesOrderListItem) => {
  if (!users.value.length || !paymentAccounts.value.length) {
    await loadUsers()
  }
  fillFormForEdit(order)
  visible.value = true
}

const openForTailPayment = async (order: ThirdSalesOrderListItem, payload: ThirdSalesOrderPayload) => {
  if (!users.value.length || !paymentAccounts.value.length) {
    await loadUsers()
  }
  fillFormForEdit(order)
  form.orderType = payload.orderType
  form.productName = payload.productName
  form.paymentAmount = payload.paymentAmount
  form.contractAmount = payload.contractAmount
  form.paymentSerialNo = payload.paymentSerialNo
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
  ElMessage.warning('补充证据最多上传 20 个')
}

const handleEvidenceFilesPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedFiles = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile())
    .filter((item): item is File => Boolean(item))

  if (!pastedFiles.length) {
    ElMessage.warning('请先复制图片或文件，再粘贴到补充证据区')
    return
  }

  const remain = 20 - evidenceFileList.value.length
  if (remain <= 0) {
    ElMessage.warning('补充证据最多上传 20 个')
    return
  }

  const nextFiles = pastedFiles.slice(0, remain)
  const nextList = [
    ...evidenceFileList.value,
    ...nextFiles.map((file) =>
      ({
        name: file.name || `证据文件-${Date.now()}`,
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        raw: file,
      }) as UploadFile,
    ),
  ]
  syncEvidenceFiles(nextList)
  ElMessage.success(`已粘贴 ${nextFiles.length} 个补充证据`)
}

const handlePaymentScreenshotChange = (file: { raw?: File }) => {
  form.paymentScreenshot = file.raw || null
  paymentScreenshotPreviewUrl.value = file.raw ? URL.createObjectURL(file.raw) : ''
  paymentScreenshotList.value = file.raw
    ? [
        {
          name: file.raw.name,
          url: paymentScreenshotPreviewUrl.value,
          raw: file.raw,
        } as UploadFile,
      ]
    : []
}

const handlePaymentScreenshotRemove = () => {
  form.paymentScreenshot = null
  paymentScreenshotList.value = []
  paymentScreenshotPreviewUrl.value = ''
}

const handlePaymentScreenshotPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const file = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile())
    .find((item): item is File => Boolean(item))

  if (!file) {
    ElMessage.warning('请先复制付款截图，再粘贴到付款截图区域')
    return
  }

  handlePaymentScreenshotChange({ raw: file })
  ElMessage.success('付款截图已粘贴')
}

const handleChatRecordChange = (file: { raw?: File }) => {
  form.chatRecordFile = file.raw || null
  chatRecordPreviewUrl.value = file.raw ? URL.createObjectURL(file.raw) : ''
  chatRecordFileList.value = file.raw
    ? [
        {
          name: file.raw.name,
          url: chatRecordPreviewUrl.value,
          raw: file.raw,
        } as UploadFile,
      ]
    : []
}

const handleChatRecordRemove = () => {
  form.chatRecordFile = null
  chatRecordFileList.value = []
  chatRecordPreviewUrl.value = ''
}

const handleChatRecordPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const file = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile())
    .find((item): item is File => Boolean(item))

  if (!file) {
    ElMessage.warning('请先复制聊天记录截图，再粘贴到聊天记录区域')
    return
  }

  handleChatRecordChange({ raw: file })
  ElMessage.success('聊天记录已粘贴')
}

const amountPattern = /^\d+(\.\d{1,2})?$/

const submit = async () => {
  if (!form.phone.trim()) {
    ElMessage.warning('请输入客户手机号')
    return
  }

  if (!currentCustomer.value) {
    ElMessage.warning('请先搜索并选择已有一销客户')
    return
  }

  if (!form.thirdSalesUserId) {
    ElMessage.warning('请选择三销人员')
    return
  }

  if (!form.paymentAccountId) {
    ElMessage.warning('请选择收款账户')
    return
  }

  if (!form.productName.trim()) {
    ElMessage.warning('请输入服务项目')
    return
  }

  if (!amountPattern.test(form.paymentAmount.trim())) {
    ElMessage.warning('请输入正确的付款金额')
    return
  }

  if (!amountPattern.test(form.contractAmount.trim())) {
    ElMessage.warning('请输入正确的应收金额')
    return
  }

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
      productName: form.productName.trim(),
      paymentAmount: form.paymentAmount.trim(),
      paymentSerialNo: form.paymentSerialNo.trim(),
      remark: form.remark?.trim(),
    }

    if (editingOrder.value) {
      await updateThirdSalesOrder(editingOrder.value.id, payload)
      ElMessage.success('三销业绩已更新')
      visible.value = false
      emit('updated')
      return
    }

    await createThirdSalesOrder(payload)
    ElMessage.success('三销业绩已保存')
    visible.value = false
    emit('updated')
  } finally {
    loading.value = false
  }
}

watch(visible, (value) => {
  if (!value && !loading.value) {
    currentCustomer.value = null
    editingOrder.value = null
    Object.assign(form, initialForm())
    evidenceFileList.value = []
    paymentScreenshotList.value = []
    chatRecordFileList.value = []
    paymentScreenshotPreviewUrl.value = ''
    chatRecordPreviewUrl.value = ''
  }
})

defineExpose({ openForCustomer, openForEdit, openForTailPayment })
</script>

<template>
  <el-drawer v-model="visible" :title="isEditMode() ? '编辑三销业绩' : '录入三销业绩'" size="700px">
    <div class="page-stack drawer-body">
      <el-card shadow="never" class="summary-card">
        <template #header>
          <div class="section-title">客户信息</div>
        </template>
        <div v-if="currentCustomer" class="customer-summary-grid">
          <div class="summary-item"><span class="summary-label">客户编号</span><span class="summary-value">{{ currentCustomer?.customerNo || '-' }}</span></div>
          <div class="summary-item"><span class="summary-label">客户姓名</span><span class="summary-value">{{ currentCustomer?.name || '-' }}</span></div>
          <div class="summary-item"><span class="summary-label">手机号码</span><span class="summary-value">{{ formatPhone(currentCustomer?.phone || form.phone, currentCustomer || undefined) }}</span></div>
          <div class="summary-item"><span class="summary-label">当前状态</span><span class="summary-value">{{ currentCustomer?.currentStatus || '-' }}</span></div>
          <div class="summary-item"><span class="summary-label">来源阶段</span><span class="summary-value">{{ sourceStageLabel(currentCustomer?.thirdSalesSourceStage) }}</span></div>
          <div class="summary-item"><span class="summary-label">一销付款</span><span class="summary-value">{{ formatCurrency(currentCustomer?.firstPaymentAmount) }}</span></div>
          <div class="summary-item"><span class="summary-label">二销付款</span><span class="summary-value">{{ formatCurrency(currentCustomer?.secondPaymentAmount) }}</span></div>
          <div class="summary-item"><span class="summary-label">累计回款</span><span class="summary-value">{{ formatCurrency(currentCustomer?.totalPaymentAmount) }}</span></div>
          <div class="summary-item"><span class="summary-label">欠款金额</span><span class="summary-value">{{ formatCurrency(currentCustomer?.arrearsAmount) }}</span></div>
        </div>
      </el-card>

      <el-card shadow="never" class="summary-card cost-card">
        <template #header>
          <div class="section-title">业绩计算</div>
        </template>
        <div class="cost-grid">
          <div class="summary-item accent-item"><span class="summary-label">付款金额</span><span class="summary-value">{{ form.paymentAmount || '0.00' }}</span></div>
          <div class="summary-item warning-item"><span class="summary-label">开庭成本</span><span class="summary-value">{{ formatCurrency(hearingCost) }}</span></div>
          <div class="summary-item success-item"><span class="summary-label">实际业绩</span><span class="summary-value">{{ formatCurrency(actualPerformanceAmount) }}</span></div>
        </div>
      </el-card>

      <el-card shadow="never" class="form-card">
        <template #header>
          <div class="section-title">录单信息</div>
        </template>
        <el-alert :title="isEditMode() ? '编辑时如不重新上传文件，将保留当前付款截图、聊天记录与证据' : '系统会自动按 付款金额 - 开庭成本 计算实际业绩；定金单聊天记录可不传，尾款/全款必须上传聊天记录。'" type="info" :closable="false" show-icon />

        <el-form label-position="top" class="page-stack form-stack">
          <div class="form-grid compact-grid">
            <el-form-item label="三销人员">
              <el-select v-model="form.thirdSalesUserId" placeholder="请选择三销人员">
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
            <el-form-item label="服务项目"><el-input v-model="form.productName" placeholder="请输入开庭服务、庭审代理等项目" clearable /></el-form-item>
            <el-form-item label="应收金额"><el-input v-model="form.contractAmount" placeholder="请输入应收金额" clearable /></el-form-item>
            <el-form-item label="付款金额"><el-input v-model="form.paymentAmount" placeholder="请输入付款金额" /></el-form-item>
            <el-form-item label="收款账户">
              <el-select v-model="form.paymentAccountId" placeholder="请选择收款账户" filterable>
                <el-option v-for="item in paymentAccounts" :key="item.id" :label="`${item.accountName}（${item.accountNo}）`" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="付款单号"><el-input v-model="form.paymentSerialNo" placeholder="请输入付款单号" clearable /></el-form-item>
            <el-form-item v-if="canEditOrderTime()" label="录单时间">
              <el-date-picker v-model="form.orderDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择录单时间" style="width: 100%" />
            </el-form-item>
          </div>

          <div class="form-grid compact-grid">
            <el-form-item label="剩余欠款"><el-input :model-value="String(Math.max(Number(form.contractAmount || 0) - Number(form.paymentAmount || 0), 0))" disabled /></el-form-item>
          </div>

          <el-form-item label="付款截图" class="full-width">
            <div class="page-stack-sm full-width upload-panel card-like-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handlePaymentScreenshotPaste">复制图片后，在这里按 Ctrl+V 粘贴付款截图</div>
              <img v-if="paymentScreenshotPreviewUrl" :src="paymentScreenshotPreviewUrl" alt="付款截图预览" class="paste-image-preview" />
              <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前付款截图</div>
              <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :file-list="paymentScreenshotList" :on-change="handlePaymentScreenshotChange" :on-remove="handlePaymentScreenshotRemove">
                <el-button>上传付款截图</el-button>
              </el-upload>
            </div>
          </el-form-item>

          <el-form-item :label="requiresChatRecord ? '聊天记录截图（必传）' : '聊天记录截图（定金可不传）'" class="full-width">
            <div class="page-stack-sm full-width upload-panel card-like-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handleChatRecordPaste">{{ requiresChatRecord ? '复制聊天截图后，在这里按 Ctrl+V 粘贴（尾款/全款必传）' : '当前为定金单，聊天截图可不上传' }}</div>
              <img v-if="chatRecordPreviewUrl" :src="chatRecordPreviewUrl" alt="聊天记录预览" class="paste-image-preview" />
              <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前聊天记录</div>
              <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :file-list="chatRecordFileList" :on-change="handleChatRecordChange" :on-remove="handleChatRecordRemove">
                <el-button>上传聊天记录</el-button>
              </el-upload>
            </div>
          </el-form-item>

          <el-form-item label="业绩备注"><el-input v-model="form.remark" type="textarea" :rows="4" placeholder="请输入三销业绩说明、服务结果或补充备注" /></el-form-item>

          <el-form-item label="补充证据" class="upload-item full-width">
            <div class="page-stack-sm full-width upload-panel card-like-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handleEvidenceFilesPaste">复制证据截图或文件后，在这里按 Ctrl+V 可直接粘贴</div>
              <div v-if="isEditMode()" class="upload-tip">编辑时如不重新上传，将保留当前补充证据</div>
              <el-upload :auto-upload="false" :show-file-list="true" :file-list="evidenceFileList" multiple :limit="20" :on-change="handleEvidenceFilesChange" :on-remove="handleEvidenceFilesRemove" :on-exceed="handleEvidenceFilesExceed">
                <el-button>上传补充证据</el-button>
              </el-upload>
            </div>
          </el-form-item>

          <el-form-item class="full-width form-actions">
            <el-button type="primary" size="large" :loading="loading" @click="submit">{{ isEditMode() ? '保存修改' : '保存三销业绩' }}</el-button>
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

.customer-summary-grid,
.cost-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cost-card .cost-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

.accent-item {
  background: var(--el-color-primary-light-9);
}

.warning-item {
  background: var(--el-color-warning-light-9);
}

.success-item {
  background: var(--el-color-success-light-9);
}

.summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.summary-value {
  color: var(--el-text-color-primary);
  font-weight: 600;
  word-break: break-all;
}

.form-stack {
  margin-top: 16px;
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
  max-height: 240px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
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
