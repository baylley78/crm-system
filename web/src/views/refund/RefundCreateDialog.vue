<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { createRefundCase, fetchRefundFirstSalesDepartments } from '../../api/refund'
import type { CreateRefundCasePayload, RefundFirstSalesDepartmentOption, RefundSourceStage } from '../../types'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  success: []
}>()

interface RefundDraft {
  customerId?: number
  customerName?: string
  phone?: string
  sourceStage: RefundSourceStage
  reason?: string
  expectedRefundAmount?: number
  remark?: string
  firstSalesDepartmentId?: number
}

const props = defineProps<{
  draft?: Partial<RefundDraft> | null
  loading?: boolean
}>()

const saving = computed(() => Boolean(props.loading))
const departmentLoading = ref(false)
const departmentOptions = ref<RefundFirstSalesDepartmentOption[]>([])
const isManualCreate = computed(() => !props.draft?.customerId && !props.draft?.customerName && !props.draft?.phone)

const form = reactive<CreateRefundCasePayload>({
  customerId: undefined,
  customerName: '',
  phone: '',
  sourceStage: 'CUSTOMER',
  firstSalesDepartmentId: undefined,
  reason: '',
  expectedRefundAmount: 0,
  remark: '',
})

const sourceStageOptions: Array<{ label: string; value: RefundSourceStage }> = [
  { label: '客户列表', value: 'CUSTOMER' },
  { label: '一销', value: 'FIRST_SALES' },
  { label: '二销', value: 'SECOND_SALES' },
  { label: '法务', value: 'LEGAL' },
  { label: '调解', value: 'MEDIATION' },
  { label: '三销', value: 'THIRD_SALES' },
]

const selectedDepartment = computed(() => departmentOptions.value.find((item) => item.id === form.firstSalesDepartmentId))
const selectedTeamName = computed(() => selectedDepartment.value?.teamName || '-')

const loadDepartments = async () => {
  departmentLoading.value = true
  try {
    departmentOptions.value = await fetchRefundFirstSalesDepartments()
  } finally {
    departmentLoading.value = false
  }
}

const applyDraft = () => {
  form.customerId = props.draft?.customerId ? Number(props.draft.customerId) : undefined
  form.customerName = props.draft?.customerName || ''
  form.phone = props.draft?.phone || ''
  form.sourceStage = props.draft?.sourceStage || 'CUSTOMER'
  form.firstSalesDepartmentId = props.draft?.firstSalesDepartmentId ? Number(props.draft.firstSalesDepartmentId) : undefined
  form.reason = props.draft?.reason || ''
  form.expectedRefundAmount = Number(props.draft?.expectedRefundAmount || 0)
  form.remark = props.draft?.remark || ''
}

watch(() => props.draft, applyDraft, { immediate: true, deep: true })
watch(visible, async (value) => {
  if (value) {
    applyDraft()
    if (!departmentOptions.value.length) {
      await loadDepartments()
    }
  }
})

const submit = async () => {
  if (!form.reason.trim()) {
    ElMessage.warning('请填写退款原因')
    return
  }

  if (isManualCreate.value) {
    if (!form.customerName?.trim() || !form.phone?.trim()) {
      ElMessage.warning('请填写客户姓名和手机号')
      return
    }
  } else if (!form.customerId && !form.phone?.trim()) {
    ElMessage.warning('请填写客户手机号')
    return
  }

  await createRefundCase({
    customerId: form.customerId,
    customerName: form.customerName?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    sourceStage: form.sourceStage,
    firstSalesDepartmentId: form.firstSalesDepartmentId,
    reason: form.reason.trim(),
    expectedRefundAmount: Number(form.expectedRefundAmount || 0),
    remark: form.remark?.trim() || undefined,
  })

  ElMessage.success('退款申请已创建')
  visible.value = false
  emit('success')
}
</script>

<template>
  <el-dialog v-model="visible" title="新建退款单" width="640px">
    <el-form label-width="120px" class="page-stack">
      <template v-if="isManualCreate">
        <el-form-item label="客户姓名">
          <el-input v-model="form.customerName" placeholder="请输入客户姓名" />
        </el-form-item>
        <el-form-item label="手机号码">
          <el-input v-model="form.phone" placeholder="请输入客户手机号" />
        </el-form-item>
      </template>
      <template v-else>
        <el-form-item v-if="form.customerName" label="客户姓名">
          <div class="static-text">{{ form.customerName }}</div>
        </el-form-item>
        <el-form-item v-if="form.phone" label="手机号码">
          <div class="static-text">{{ form.phone }}</div>
        </el-form-item>
      </template>
      <el-form-item label="来源阶段">
        <el-select v-model="form.sourceStage" style="width: 100%">
          <el-option v-for="item in sourceStageOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="一销部门">
        <el-select v-model="form.firstSalesDepartmentId" clearable filterable :loading="departmentLoading" placeholder="可手动选择一销部门" style="width: 100%">
          <el-option v-for="item in departmentOptions" :key="item.id" :label="`${item.name}${item.teamName ? `（团队：${item.teamName}）` : ''}`" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="一销团队">
        <div class="static-text">{{ selectedTeamName }}</div>
      </el-form-item>
      <el-form-item label="期望退款金额">
        <el-input-number v-model="form.expectedRefundAmount" :min="0" :precision="2" style="width: 100%" />
      </el-form-item>
      <el-form-item label="退款原因">
        <el-input v-model="form.reason" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">提交</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.static-text {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}
</style>
