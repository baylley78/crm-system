<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import { authStorage } from '../../auth'
import { formatPhone } from '../../utils/permissions'
import { createFirstSalesTailOrder, fetchFirstSalesUsers } from '../../api/dashboard'
import { fetchPaymentAccountOptions } from '../../api/payment-accounts'
import type { CustomerItem, FirstSalesTailOrderPayload, PaymentAccountOption, SalesUserOption } from '../../types'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  updated: []
}>()

const loading = ref(false)
const users = ref<SalesUserOption[]>([])
const paymentAccounts = ref<PaymentAccountOption[]>([])
const currentCustomer = ref<CustomerItem | null>(null)
const paymentScreenshotList = ref<UploadFile[]>([])
const chatRecordFileList = ref<UploadFile[]>([])
const paymentScreenshotPreviewUrl = ref('')
const chatRecordPreviewUrl = ref('')

const initialForm = (): FirstSalesTailOrderPayload => ({
  salesUserId: 0,
  isTimelyDeal: 'true',
  targetAmount: 0,
  contractAmount: 0,
  paymentAmount: 0,
  arrearsAmount: 0,
  paymentAccountId: 0,
  paymentSerialNo: '',
  paymentScreenshot: null,
  chatRecordFile: null,
  remark: '',
  evidenceImages: [],
})

const form = reactive<FirstSalesTailOrderPayload>(initialForm())

const syncAmounts = () => {
  form.targetAmount = Number(form.targetAmount) || 0
  form.paymentAmount = Number(form.paymentAmount) || 0
  form.contractAmount = form.targetAmount
  const arrears = Number((form.contractAmount - form.paymentAmount).toFixed(2))
  form.arrearsAmount = arrears > 0 ? arrears : 0
}

const assignDefaultSalesUser = () => {
  const currentUser = authStorage.getUser()
  const preferredId = currentCustomer.value?.firstSalesUserName ? users.value.find((item) => item.realName === currentCustomer.value?.firstSalesUserName)?.id : undefined
  form.salesUserId = preferredId || currentUser?.id || users.value[0]?.id || 0
}

const resetForm = () => {
  Object.assign(form, initialForm())
  paymentScreenshotList.value = []
  chatRecordFileList.value = []
  paymentScreenshotPreviewUrl.value = ''
  chatRecordPreviewUrl.value = ''
  if (currentCustomer.value) {
    form.targetAmount = Number(currentCustomer.value.arrearsAmount || 0)
    syncAmounts()
  }
  assignDefaultSalesUser()
}

const loadUsers = async () => {
  const [userList, paymentAccountList] = await Promise.all([fetchFirstSalesUsers(), fetchPaymentAccountOptions()])
  users.value = userList
  paymentAccounts.value = paymentAccountList
  assignDefaultSalesUser()
  if (!form.paymentAccountId) {
    form.paymentAccountId = paymentAccounts.value[0]?.id || 0
  }
}

const openForCustomer = async (customer: CustomerItem) => {
  currentCustomer.value = customer
  visible.value = true
  resetForm()
  if (!users.value.length) {
    await loadUsers()
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

const handlePaymentScreenshotRemove = () => {
  form.paymentScreenshot = null
  paymentScreenshotList.value = []
  paymentScreenshotPreviewUrl.value = ''
}

const handlePaymentScreenshotPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const imageFile = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .find(Boolean)

  if (!imageFile) {
    ElMessage.warning('请先复制图片，再粘贴到这里')
    return
  }

  const file = new File([imageFile], imageFile.name || `paymentScreenshot-${Date.now()}.png`, { type: imageFile.type || 'image/png' })
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
  const imageFile = Array.from(event.clipboardData?.items || [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .find(Boolean)

  if (!imageFile) {
    ElMessage.warning('请先复制图片，再粘贴到这里')
    return
  }

  const file = new File([imageFile], imageFile.name || `chatRecord-${Date.now()}.png`, { type: imageFile.type || 'image/png' })
  handleChatRecordChange({ raw: file })
  ElMessage.success('聊天记录已粘贴')
}

const validateForm = () => {
  if (!currentCustomer.value) {
    ElMessage.warning('请先选择客户')
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

  if (!form.paymentScreenshot) {
    ElMessage.warning('请上传付款截图')
    return false
  }

  if (!form.chatRecordFile) {
    ElMessage.warning('补录尾款时请一并上传聊天记录')
    return false
  }

  if (form.paymentAmount > form.contractAmount) {
    ElMessage.warning('付款金额不能大于标的金额')
    return false
  }

  if (form.paymentAmount + form.arrearsAmount !== form.contractAmount) {
    ElMessage.warning('付款金额与欠款金额之和必须等于标的金额')
    return false
  }

  return true
}

const submit = async () => {
  if (!currentCustomer.value || !validateForm()) {
    return
  }

  loading.value = true
  try {
    await createFirstSalesTailOrder(currentCustomer.value.id, form)
    ElMessage.success('尾款补录成功，客户资料已同步')
    visible.value = false
    emit('updated')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '提交失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

watch(
  () => [form.targetAmount, form.paymentAmount],
  () => {
    syncAmounts()
  },
)

watch(visible, (value) => {
  if (!value && !loading.value) {
    resetForm()
  }
})

defineExpose({ openForCustomer })
</script>

<template>
  <el-drawer v-model="visible" title="补录尾款" size="560px">
    <el-form label-width="110px" class="page-stack">
      <el-alert title="快捷补录客户尾款，保存后将同步客户档案，并自动刷新客户列表与一销业绩列表" type="info" :closable="false" show-icon />

      <el-card shadow="never">
        <template #header>客户信息</template>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="客户编号">{{ currentCustomer?.customerNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户姓名">{{ currentCustomer?.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号码">{{ formatPhone(currentCustomer?.phone, currentCustomer || undefined) }}</el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ currentCustomer?.currentStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="当前欠款">{{ currentCustomer?.arrearsAmount ?? 0 }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never">
        <template #header>尾款信息</template>
        <el-alert title="快捷补录客户尾款，保存后将同步客户档案，并自动刷新客户列表与一销业绩列表" type="info" :closable="false" show-icon />
        <div class="form-grid compact-grid">
          <el-form-item label="一销人员">
            <el-select v-model="form.salesUserId" placeholder="请选择一销人员">
              <el-option v-for="item in users" :key="item.id" :label="item.realName" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="欠款金额"><el-input v-model.number="form.targetAmount" placeholder="请输入欠款金额" type="number" /></el-form-item>
          <el-form-item label="付款金额"><el-input v-model.number="form.paymentAmount" placeholder="请输入付款金额" type="number" /></el-form-item>
          <el-form-item label="收款账户" class="full-width">
            <el-select v-model="form.paymentAccountId" placeholder="请选择收款账户" filterable>
              <el-option v-for="item in paymentAccounts" :key="item.id" :label="`${item.accountName}（${item.accountNo}）`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="付款单号" class="full-width"><el-input v-model="form.paymentSerialNo" placeholder="请输入付款单号" /></el-form-item>
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
          <el-form-item label="聊天记录" class="full-width">
            <div class="page-stack-sm full-width upload-panel">
              <div class="paste-upload-box" tabindex="0" @paste="handleChatRecordPaste">
                复制聊天截图后，在这里按 Ctrl+V 粘贴聊天记录
              </div>
              <div class="upload-tip">定金客户补录尾款时，需一并上传聊天记录</div>
              <img v-if="chatRecordPreviewUrl" :src="chatRecordPreviewUrl" alt="聊天记录预览" class="paste-image-preview" />
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

      <el-form-item class="full-width form-actions">
        <el-button type="primary" :loading="loading" @click="submit">保存尾款</el-button>
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
