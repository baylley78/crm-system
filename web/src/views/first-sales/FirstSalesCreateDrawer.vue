<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authStorage } from '../../auth'
import { createFirstSalesOrder, fetchFirstSalesUsers, updateFirstSalesOrder } from '../../api/dashboard'
import { fetchPaymentAccountOptions } from '../../api/payment-accounts'
import { hasPermission } from '../../utils/permissions'
import type { FirstSalesForm, FirstSalesListItem, PaymentAccountOption, SalesUserOption } from '../../types'

const router = useRouter()
const canEditOrderTime = () => hasPermission('firstSales.time.edit')

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  updated: []
  closed: []
}>()

const editingOrder = ref<FirstSalesListItem | null>(null)
const loading = ref(false)
const users = ref<SalesUserOption[]>([])
const paymentAccounts = ref<PaymentAccountOption[]>([])
const paymentScreenshotList = ref<UploadFile[]>([])
const chatRecordFileList = ref<UploadFile[]>([])
const evidenceImageList = ref<UploadFile[]>([])
const paymentScreenshotPreviewUrl = ref('')
const chatRecordPreviewUrl = ref('')
const caseTypeTemplateOptions = ['婚姻家事', '债务纠纷', '合同纠纷', '劳动争议', '交通事故']
const ageOptions = [
  { label: '24以下', value: 24 },
  { label: '25-30', value: 25 },
  { label: '31-35', value: 31 },
  { label: '36-40', value: 36 },
  { label: '41-45', value: 41 },
  { label: '46-50', value: 46 },
  { label: '51-55', value: 51 },
  { label: '56-60', value: 56 },
  { label: '60以上', value: 61 },
]

const initialForm = (): FirstSalesForm => ({
  customerName: '',
  phone: '',
  wechat: '',
  gender: '男',
  age: null,
  province: '',
  city: '',
  source: '',
  caseType: '',
  intentionLevel: '',
  salesUserId: 0,
  orderType: 'DEPOSIT',
  isTimelyDeal: 'true',
  targetAmount: 0,
  contractAmount: 0,
  paymentAmount: 0,
  arrearsAmount: 0,
  paymentAccountId: 0,
  paymentSerialNo: '',
  orderDate: '',
  paymentScreenshot: null,
  chatRecordFile: null,
  remark: '',
  evidenceImages: [],
})

const form = reactive<FirstSalesForm>(initialForm())

const isEditMode = () => Boolean(editingOrder.value)

const shouldRequireChatRecord = () => form.orderType === 'TAIL' || form.orderType === 'FULL'

const toOrderTypeCode = (value?: string): FirstSalesForm['orderType'] => {
  if (value === '尾款') {
    return 'TAIL'
  }
  if (value === '全款') {
    return 'FULL'
  }
  return 'DEPOSIT'
}

const syncAmounts = () => {
  form.contractAmount = Number(form.contractAmount) || 0
  form.targetAmount = Number(form.targetAmount) || 0
  form.paymentAmount = Number(form.paymentAmount) || 0
  const arrears = Number((form.contractAmount - form.paymentAmount).toFixed(2))
  form.arrearsAmount = arrears > 0 ? arrears : 0
}

const assignDefaultSalesUser = () => {
  const currentUser = authStorage.getUser()
  const matchedUser = users.value.find((item) => item.id === currentUser?.id)
  form.salesUserId = matchedUser?.id || users.value[0]?.id || 0
}

const resetForm = () => {
  editingOrder.value = null
  Object.assign(form, initialForm())
  paymentScreenshotList.value = []
  chatRecordFileList.value = []
  evidenceImageList.value = []
  paymentScreenshotPreviewUrl.value = ''
  chatRecordPreviewUrl.value = ''
  assignDefaultSalesUser()
}

const fillFormForEdit = (order: FirstSalesListItem) => {
  editingOrder.value = order
  form.customerName = order.name
  form.phone = order.phone
  form.wechat = order.wechat || ''
  form.gender = order.gender || '男'
  form.age = order.age ?? null
  form.province = order.province || ''
  form.city = order.city || ''
  form.source = order.source || ''
  form.caseType = order.caseType || ''
  form.intentionLevel = order.intentionLevel || ''
  form.salesUserId = order.salesUserId || users.value.find((item) => item.realName === order.salesUserName)?.id || users.value[0]?.id || 0
  form.orderType = toOrderTypeCode(order.orderType)
  form.isTimelyDeal = order.isTimelyDeal ? 'true' : 'false'
  form.targetAmount = Number(order.targetAmount || 0)
  form.contractAmount = Number(order.contractAmount || 0)
  form.paymentAmount = Number(order.paymentAmount || 0)
  form.arrearsAmount = Number(order.arrearsAmount || 0)
  form.paymentAccountId = order.paymentAccountId || paymentAccounts.value[0]?.id || 0
  form.paymentSerialNo = order.paymentSerialNo || ''
  form.orderDate = order.orderDate ? order.orderDate.slice(0, 16) : ''
  form.paymentScreenshot = null
  form.chatRecordFile = null
  form.evidenceImages = []
  form.remark = order.remark || ''
  paymentScreenshotList.value = order.paymentScreenshotUrl
    ? [
        {
          name: '当前付款截图',
          url: order.paymentScreenshotUrl,
        } as UploadFile,
      ]
    : []
  chatRecordFileList.value = []
  evidenceImageList.value = order.evidenceImageUrls.map((url, index) => ({
    name: `当前证据${index + 1}`,
    url,
  }) as UploadFile)
  paymentScreenshotPreviewUrl.value = order.paymentScreenshotUrl || ''
  chatRecordPreviewUrl.value = ''
}

const closeDrawer = async () => {
  if (loading.value) {
    return
  }

  if (!hasUnsavedChanges()) {
    visible.value = false
    return
  }

  try {
    await ElMessageBox.confirm('确认关闭将丢失未保存的录单内容，是否继续？', '提示', {
      type: 'warning',
      confirmButtonText: '确认关闭',
      cancelButtonText: '继续填写',
    })
    visible.value = false
  } catch {
    return
  }
}

const hasUnsavedChanges = () => {
  const initial = initialForm()
  return Object.keys(initial).some((key) => {
    const field = key as keyof FirstSalesForm
    const currentValue = form[field]
    const initialValue = initial[field]

    if (Array.isArray(currentValue) || Array.isArray(initialValue)) {
      return (currentValue as unknown[]).length !== (initialValue as unknown[]).length
    }

    return currentValue !== initialValue
  }) || paymentScreenshotList.value.length > 0 || chatRecordFileList.value.length > 0 || evidenceImageList.value.length > 0
}

const loadUsers = async () => {
  const [userList, paymentAccountList] = await Promise.all([fetchFirstSalesUsers(), fetchPaymentAccountOptions()])
  users.value = userList
  paymentAccounts.value = paymentAccountList
  if (!form.salesUserId) {
    assignDefaultSalesUser()
  }
  if (!form.paymentAccountId) {
    form.paymentAccountId = paymentAccounts.value[0]?.id || 0
  }
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

const handleEvidenceImagesChange = (_: UploadFile, fileList: UploadFile[]) => {
  syncEvidenceImages(fileList)
}

const handleEvidenceImagesRemove = (_: UploadFile, fileList: UploadFile[]) => {
  syncEvidenceImages(fileList)
}

const handleEvidenceImagesExceed = () => {
  ElMessage.warning('证据图片最多上传 20 张')
}

const syncEvidenceImages = (fileList: UploadFile[]) => {
  evidenceImageList.value = fileList
  form.evidenceImages = fileList.reduce<File[]>((files, item) => {
    if (item.raw) {
      files.push(item.raw as File)
    }
    return files
  }, [])
}

const handleEvidenceImagesPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const pastedFiles = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((item): item is File => Boolean(item))

  if (!pastedFiles.length) {
    ElMessage.warning('请先复制图片，再粘贴到证据栏')
    return
  }

  const remain = 20 - evidenceImageList.value.length
  if (remain <= 0) {
    ElMessage.warning('证据图片最多上传 20 张')
    return
  }

  const nextFiles = pastedFiles.slice(0, remain)
  const nextList = [
    ...evidenceImageList.value,
    ...nextFiles.map((file) =>
      ({
        name: file.name || `evidence-${Date.now()}.png`,
        url: URL.createObjectURL(file),
        raw: file,
      }) as UploadFile,
    ),
  ]
  syncEvidenceImages(nextList)

  if (pastedFiles.length > remain) {
    ElMessage.warning('超出部分未添加，证据图片最多上传 20 张')
    return
  }

  ElMessage.success(`已粘贴 ${nextFiles.length} 张证据图片`)
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

const isValidPhone = (value: string) => /^\d{11}$/.test(value.trim())

const validateForm = () => {
  if (!form.customerName.trim()) {
    ElMessage.warning('请输入客户姓名')
    return false
  }

  if (!form.phone.trim()) {
    ElMessage.warning('请输入手机号')
    return false
  }

  if (!isValidPhone(form.phone)) {
    ElMessage.warning('客户手机号必须为11位数字')
    return false
  }

  if (!form.salesUserId) {
    ElMessage.warning('请选择一销人员')
    return false
  }

  if (!form.paymentAccountId) {
    ElMessage.warning('请选择收款账户')
    return false
  }

  if (!form.paymentSerialNo.trim()) {
    ElMessage.warning('请输入付款单号')
    return false
  }

  if (!form.paymentScreenshot && !isEditMode()) {
    ElMessage.warning('请上传付款截图')
    return false
  }

  if (shouldRequireChatRecord() && !form.chatRecordFile && !isEditMode()) {
    ElMessage.warning('尾款和全款必须上传客户聊天记录')
    return false
  }

  if (form.paymentAmount > form.contractAmount) {
    ElMessage.warning('付款金额不能大于合同金额')
    return false
  }

  if (form.paymentAmount + form.arrearsAmount !== form.contractAmount) {
    ElMessage.warning('付款金额与欠款金额之和必须等于合同金额')
    return false
  }

  return true
}

const submit = async () => {
  if (!validateForm()) {
    return
  }

  loading.value = true
  try {
    if (editingOrder.value) {
      await updateFirstSalesOrder(editingOrder.value.id, form)
      localStorage.setItem('crm_customers_refresh_at', String(Date.now()))
      localStorage.setItem('crm_customers_refresh_phone', form.phone.trim())
      ElMessage.success('一销业绩已更新')
      resetForm()
      closeDrawer()
      emit('updated')
      return
    }

    const result = await createFirstSalesOrder(form)
    if (!result?.customerId || !result?.customerNo) {
      throw new Error('客户档案同步失败')
    }
    localStorage.setItem('crm_customers_refresh_at', String(Date.now()))
    localStorage.setItem('crm_customers_refresh_phone', form.phone.trim())
    ElMessage.success(`保存成功，客户已建档：${result.customerNo}`)
    resetForm()
    closeDrawer()
    emit('updated')
    await router.push({ path: '/customers', query: { phone: form.phone.trim(), auto: '1' } })
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '提交失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

watch(
  () => [form.contractAmount, form.paymentAmount],
  () => {
    syncAmounts()
  },
)

watch(visible, (value) => {
  if (value) {
    if (!users.value.length) {
      void loadUsers()
      return
    }
    if (!editingOrder.value) {
      assignDefaultSalesUser()
    }
    return
  }

  if (!loading.value) {
    resetForm()
  }
  emit('closed')
})

const openForEdit = async (order: FirstSalesListItem) => {
  if (!users.value.length || !paymentAccounts.value.length) {
    await loadUsers()
  }
  fillFormForEdit(order)
  visible.value = true
}

onMounted(loadUsers)

defineExpose({
  openForEdit,
})
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="isEditMode() ? '编辑一销业绩' : '录入业绩'"
    size="560px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :before-close="closeDrawer"
  >
    <el-form label-width="110px" class="page-stack">
      <el-alert :title="isEditMode() ? '保存后将更新客户档案与一销业绩记录' : '保存后将同步客户档案，并自动刷新一销业绩列表'" type="info" :closable="false" show-icon />

      <el-card shadow="never">
        <template #header>客户基础信息</template>
        <div class="form-grid">
          <el-form-item label="客户姓名"><el-input v-model="form.customerName" placeholder="请输入客户姓名" /></el-form-item>
          <el-form-item label="手机号码"><el-input v-model="form.phone" placeholder="请输入手机号" /></el-form-item>
          <el-form-item label="性别">
            <el-radio-group v-model="form.gender">
              <el-radio label="男">男</el-radio>
              <el-radio label="女">女</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年龄" class="full-width">
            <el-select v-model="form.age" placeholder="请选择年龄区间" clearable style="width: 100%">
              <el-option v-for="item in ageOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="案件类型" class="full-width">
            <el-select v-model="form.caseType" filterable allow-create default-first-option placeholder="请选择或输入案件类型" style="width: 100%">
              <el-option v-for="item in caseTypeTemplateOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>合同与付款信息</template>
        <el-alert :title="isEditMode() ? '编辑时如不重新上传截图，将保留原文件' : '保存后将同步客户档案，并自动刷新一销业绩列表'" type="info" :closable="false" show-icon />
        <div class="form-grid compact-grid">
          <el-form-item label="一销人员">
            <el-select v-model="form.salesUserId" placeholder="请选择一销人员">
              <el-option v-for="item in users" :key="item.id" :label="item.realName" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="业绩类型">
            <el-radio-group v-model="form.orderType">
              <el-radio label="DEPOSIT">定金</el-radio>
              <el-radio label="TAIL">尾款</el-radio>
              <el-radio label="FULL">全款</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="是否及时成交">
            <el-radio-group v-model="form.isTimelyDeal">
              <el-radio label="true">是</el-radio>
              <el-radio label="false">否</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="标的金额"><el-input v-model.number="form.targetAmount" placeholder="请输入案件标的金额，不作为欠款金额" type="number" /></el-form-item>
          <el-form-item label="合同金额"><el-input v-model.number="form.contractAmount" placeholder="请输入合同金额" type="number" /></el-form-item>
          <el-form-item label="付款金额"><el-input v-model.number="form.paymentAmount" placeholder="请输入付款金额" type="number" /></el-form-item>
          <el-form-item label="欠款金额"><el-input :model-value="form.arrearsAmount" disabled placeholder="系统自动计算：合同金额 - 付款金额" /></el-form-item>
          <el-form-item label="收款账户" class="full-width">
            <el-select v-model="form.paymentAccountId" placeholder="请选择收款账户" filterable>
              <el-option v-for="item in paymentAccounts" :key="item.id" :label="`${item.accountName}（${item.accountNo}）`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="付款单号" class="full-width"><el-input v-model="form.paymentSerialNo" placeholder="请输入付款单号" /></el-form-item>
          <el-form-item v-if="canEditOrderTime()" label="录单时间" class="full-width">
            <el-date-picker v-model="form.orderDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择录单时间" style="width: 100%" />
          </el-form-item>
          <el-form-item label="付款截图" class="full-width">
            <div class="page-stack-sm full-width upload-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handlePaymentScreenshotPaste">
                复制截图后，在这里按 Ctrl+V 粘贴付款截图
              </div>
              <img v-if="paymentScreenshotPreviewUrl" :src="paymentScreenshotPreviewUrl" alt="付款截图预览" class="paste-image-preview" />
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
          <el-form-item v-if="shouldRequireChatRecord()" label="聊天记录" class="full-width">
            <div class="page-stack-sm full-width upload-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handleChatRecordPaste">
                复制聊天截图后，在这里按 Ctrl+V 直接粘贴
              </div>
              <div class="upload-tip">
                尾款和全款必须上传聊天记录；编辑时如不重新上传，将保留当前文件
              </div>
              <img v-if="chatRecordPreviewUrl" :src="chatRecordPreviewUrl" alt="聊天截图预览" class="paste-image-preview" />
              <el-upload
                :auto-upload="false"
                :show-file-list="true"
                :limit="1"
                :file-list="chatRecordFileList"
                :on-change="handleChatRecordChange"
                :on-remove="handleChatRecordRemove"
              >
                <el-button>上传聊天记录</el-button>
              </el-upload>
            </div>
          </el-form-item>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>客户情况说明</template>
        <el-form-item label="客户情况说明" class="full-width"><el-input v-model="form.remark" type="textarea" :rows="4" placeholder="请输入客户情况说明" /></el-form-item>
        <el-form-item label="证据栏" class="full-width">
          <div class="page-stack-sm full-width">
            <el-alert title="可批量上传补充证据图片" type="info" :closable="false" />
            <div class="paste-upload-box" tabindex="0" @paste="handleEvidenceImagesPaste">
              复制证据图片后，在这里按 Ctrl+V 可直接批量粘贴到证据栏
            </div>
            <el-upload
              :auto-upload="false"
              :show-file-list="true"
              :file-list="evidenceImageList"
              list-type="picture-card"
              accept="image/*"
              multiple
              :limit="20"
              :on-change="handleEvidenceImagesChange"
              :on-remove="handleEvidenceImagesRemove"
              :on-exceed="handleEvidenceImagesExceed"
            >
              <el-icon><Plus /></el-icon>
            </el-upload>
          </div>
        </el-form-item>
      </el-card>

      <el-form-item class="full-width form-actions">
        <el-button type="primary" :loading="loading" @click="submit">{{ isEditMode() ? '保存修改' : '保存并同步客户' }}</el-button>
        <el-button @click="resetForm">重置</el-button>
      </el-form-item>
    </el-form>
  </el-drawer>
</template>

<style scoped>
.compact-grid {
  align-items: start;
}

.upload-panel {
  padding-top: 4px;
}

.form-actions {
  margin-top: 4px;
}

.upload-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.paste-upload-box {
  display: flex;
  align-items: center;
  min-height: 88px;
  padding: 12px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
}

.paste-upload-box:focus {
  outline: none;
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.paste-image-preview {
  display: block;
  max-width: 100%;
  max-height: 240px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}
</style>
