<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { createJudicialComplaintCase, searchJudicialComplaintCustomer } from '../../api/judicial-complaints'
import type { CreateJudicialComplaintPayload, JudicialComplaintCustomerSearchResult } from '../../types'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ success: [] }>()

const props = defineProps<{
  loading?: boolean
}>()

const saving = computed(() => Boolean(props.loading))
const submitting = ref(false)
const customerSearching = ref(false)
const matchedCustomer = ref<JudicialComplaintCustomerSearchResult | null>(null)

const form = reactive<CreateJudicialComplaintPayload>({
  customerId: undefined,
  complaintSubject: '',
  teamName: '',
  departmentName: '',
  complaintTime: new Date().toISOString().slice(0, 16),
  customerName: '',
  phone: '',
  relationToCustomer: '',
  firstSignTime: '',
  secondSignTime: '',
  firstDealAmount: 0,
  secondDealAmount: 0,
  firstSalesName: '',
  secondSalesName: '',
  legalAssistantName: '',
  summary: '',
  complaintReason: '',
  progress: '',
  refundAmount: 0,
  intervenedBeforeComplaint: false,
  suddenRefundRequest: false,
  thirdPartyGuidance: false,
  shouldHandle: true,
})

const clearMatchedCustomer = () => {
  form.customerId = undefined
  matchedCustomer.value = null
}

const resetForm = () => {
  clearMatchedCustomer()
  form.complaintSubject = ''
  form.teamName = ''
  form.departmentName = ''
  form.complaintTime = new Date().toISOString().slice(0, 16)
  form.customerName = ''
  form.phone = ''
  form.relationToCustomer = ''
  form.firstSignTime = ''
  form.secondSignTime = ''
  form.firstDealAmount = 0
  form.secondDealAmount = 0
  form.firstSalesName = ''
  form.secondSalesName = ''
  form.legalAssistantName = ''
  form.summary = ''
  form.complaintReason = ''
  form.progress = ''
  form.refundAmount = 0
  form.intervenedBeforeComplaint = false
  form.suddenRefundRequest = false
  form.thirdPartyGuidance = false
  form.shouldHandle = true
}

watch(visible, (value) => {
  if (!value) {
    resetForm()
  }
})

watch(
  () => form.phone,
  (value, previousValue) => {
    if (previousValue !== undefined && value.trim() !== previousValue.trim()) {
      clearMatchedCustomer()
    }
  },
)

const applyMatchedCustomer = (customer: JudicialComplaintCustomerSearchResult) => {
  form.customerId = customer.id
  form.customerName = customer.name
  form.phone = customer.phone
  form.teamName = customer.firstSalesTeamName || form.teamName
  form.departmentName = customer.departmentName || customer.firstSalesTeamName || form.departmentName
  form.firstSalesName = customer.firstSalesUserName || form.firstSalesName
  form.secondSalesName = customer.secondSalesUserName || form.secondSalesName
  form.legalAssistantName = customer.legalUserName || form.legalAssistantName
  form.firstDealAmount = customer.firstPaymentAmount || form.firstDealAmount || 0
  form.secondDealAmount = customer.secondPaymentAmount || form.secondDealAmount || 0
}

const handleSearchCustomer = async () => {
  const phone = form.phone.trim()
  if (!phone) {
    ElMessage.warning('请先输入手机号')
    return
  }

  customerSearching.value = true
  try {
    const customer = await searchJudicialComplaintCustomer(phone)
    if (!customer) {
      clearMatchedCustomer()
      ElMessage.warning('未找到客户，可继续手工填写')
      return
    }

    matchedCustomer.value = customer
    applyMatchedCustomer(customer)
    ElMessage.success('已带入客户信息')
  } catch (error: any) {
    clearMatchedCustomer()
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || error?.message || '客户搜索失败')
  } finally {
    customerSearching.value = false
  }
}

const submit = async () => {
  if (!form.complaintSubject.trim() || !form.customerName.trim() || !form.phone.trim() || !form.complaintReason.trim()) {
    ElMessage.warning('请填写完整的投诉主体、客户姓名、手机号和投诉原因')
    return
  }

  submitting.value = true
  try {
    await createJudicialComplaintCase({
      customerId: form.customerId,
      complaintSubject: form.complaintSubject.trim(),
      teamName: form.teamName?.trim() || undefined,
      departmentName: form.departmentName?.trim() || undefined,
      complaintTime: form.complaintTime,
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      relationToCustomer: form.relationToCustomer?.trim() || undefined,
      firstSignTime: form.firstSignTime || undefined,
      secondSignTime: form.secondSignTime || undefined,
      firstDealAmount: Number(form.firstDealAmount || 0),
      secondDealAmount: Number(form.secondDealAmount || 0),
      firstSalesName: form.firstSalesName?.trim() || undefined,
      secondSalesName: form.secondSalesName?.trim() || undefined,
      legalAssistantName: form.legalAssistantName?.trim() || undefined,
      summary: form.summary?.trim() || undefined,
      complaintReason: form.complaintReason.trim(),
      progress: form.progress?.trim() || undefined,
      refundAmount: Number(form.refundAmount || 0),
      intervenedBeforeComplaint: form.intervenedBeforeComplaint,
      suddenRefundRequest: form.suddenRefundRequest,
      thirdPartyGuidance: form.thirdPartyGuidance,
      shouldHandle: form.shouldHandle,
    })

    ElMessage.success('司法投诉已提交')
    visible.value = false
    emit('success')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message?.[0] || error?.response?.data?.message || error?.message || '司法投诉提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="新建司法投诉" width="960px">
    <div class="page-stack">
      <el-alert title="是否处理投诉为重点字段，请优先确认。" type="warning" :closable="false" show-icon />

      <el-form label-width="120px" class="page-stack">
        <el-card shadow="never">
          <template #header>客户与组织信息</template>
          <div class="form-grid complaint-grid">
            <el-form-item label="投诉主体">
              <el-input v-model="form.complaintSubject" placeholder="请输入投诉主体" />
            </el-form-item>
            <el-form-item label="所属团队">
              <el-input v-model="form.teamName" placeholder="请输入所属团队" />
            </el-form-item>
            <el-form-item label="部门">
              <el-input v-model="form.departmentName" placeholder="请输入部门" />
            </el-form-item>
            <el-form-item label="投诉时间">
              <el-date-picker v-model="form.complaintTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择投诉时间" style="width: 100%" />
            </el-form-item>
            <el-form-item label="客户姓名">
              <el-input v-model="form.customerName" placeholder="请输入客户姓名" />
            </el-form-item>
            <el-form-item label="电话" class="phone-search-item">
              <el-input v-model="form.phone" placeholder="请输入客户电话">
                <template #append>
                  <el-button :loading="customerSearching" @click="handleSearchCustomer">搜索带入</el-button>
                </template>
              </el-input>
              <div v-if="matchedCustomer" class="matched-customer muted-text">
                已匹配客户：{{ matchedCustomer.customerNo }} / {{ matchedCustomer.name }} / {{ matchedCustomer.currentStatus }}
                <span v-if="matchedCustomer.source"> / 来源：{{ matchedCustomer.source }}</span>
                <span v-if="matchedCustomer.caseType"> / 案由：{{ matchedCustomer.caseType }}</span>
              </div>
            </el-form-item>
            <el-form-item label="本人或亲属">
              <el-input v-model="form.relationToCustomer" placeholder="如：本人 / 亲属" />
            </el-form-item>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>交易与责任链信息</template>
          <div class="form-grid complaint-grid">
            <el-form-item label="一销签约时间">
              <el-date-picker v-model="form.firstSignTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择一销签约时间" style="width: 100%" />
            </el-form-item>
            <el-form-item label="二销签约时间">
              <el-date-picker v-model="form.secondSignTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择二销签约时间" style="width: 100%" />
            </el-form-item>
            <el-form-item label="一销成交金额">
              <el-input-number v-model="form.firstDealAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
            <el-form-item label="二销成交金额">
              <el-input-number v-model="form.secondDealAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
            <el-form-item label="一销人员">
              <el-input v-model="form.firstSalesName" placeholder="请输入一销人员" />
            </el-form-item>
            <el-form-item label="二销人员">
              <el-input v-model="form.secondSalesName" placeholder="请输入二销人员" />
            </el-form-item>
            <el-form-item label="法务助理">
              <el-input v-model="form.legalAssistantName" placeholder="请输入法务助理" />
            </el-form-item>
            <el-form-item label="退款金额">
              <el-input-number v-model="form.refundAmount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>投诉处理信息</template>
          <div class="page-stack-sm">
            <div class="highlight-panel">
              <span class="highlight-label">是否处理投诉</span>
              <el-radio-group v-model="form.shouldHandle">
                <el-radio :label="true">需要处理</el-radio>
                <el-radio :label="false">无需处理</el-radio>
              </el-radio-group>
            </div>
            <div class="form-grid complaint-grid">
              <el-form-item label="进度">
                <el-input v-model="form.progress" placeholder="请输入进度" />
              </el-form-item>
              <el-form-item label="投诉前是否介入">
                <el-switch v-model="form.intervenedBeforeComplaint" />
              </el-form-item>
              <el-form-item label="是否突然要退费">
                <el-switch v-model="form.suddenRefundRequest" />
              </el-form-item>
              <el-form-item label="是否为第三方引导">
                <el-switch v-model="form.thirdPartyGuidance" />
              </el-form-item>
              <el-form-item label="客户投诉原因" class="full-span">
                <el-input v-model="form.complaintReason" type="textarea" :rows="4" placeholder="请输入客户投诉原因" />
              </el-form-item>
              <el-form-item label="总结" class="full-span">
                <el-input v-model="form.summary" type="textarea" :rows="4" placeholder="请输入总结" />
              </el-form-item>
            </div>
          </div>
        </el-card>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting || saving" @click="submit">提交</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.complaint-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.full-span {
  grid-column: 1 / -1;
}

.phone-search-item :deep(.el-form-item__content) {
  display: grid;
  gap: 6px;
}

.matched-customer {
  font-size: 12px;
  line-height: 1.6;
}

.highlight-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-5);
}

.highlight-label {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-color-warning-dark-2);
}

.muted-text {
  color: var(--el-text-color-secondary);
}
</style>
