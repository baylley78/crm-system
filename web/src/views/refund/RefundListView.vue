<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { hasPermission, formatPhone } from '../../utils/permissions'
import {
  assignRefundCase,
  closeRefundCase,
  deleteRefundCase,
  fetchRefundCaseDetail,
  fetchRefundCases,
  fetchRefundFirstSalesDepartments,
  fetchRefundUsers,
  followRefundCase,
  reviewRefundCase,
  updateRefundFirstSalesDepartment,
} from '../../api/refund'
import type {
  AssignRefundCasePayload,
  CloseRefundCasePayload,
  FollowRefundCasePayload,
  RefundCaseFilters,
  RefundCaseItem,
  RefundFirstSalesDepartmentOption,
  ReviewRefundCasePayload,
  SalesUserOption,
} from '../../types'
import RefundCreateDialog from './RefundCreateDialog.vue'

const canCreateRefund = () => hasPermission('refund.create')
const canReviewRefund = () => hasPermission('refund.review')
const canAssignRefund = () => hasPermission('refund.assign')
const canEditRefund = () => hasPermission('refund.edit')
const canCloseRefund = () => hasPermission('refund.close')
const canDeleteRefund = () => hasPermission('refund.delete')
const canViewRefundDepartments = () => hasPermission('refund.department.view')
const canEditRefundDepartment = () => hasPermission('refund.department.edit')

const loading = ref(false)
const saving = ref(false)
const departmentLoading = ref(false)
const cases = ref<RefundCaseItem[]>([])
const total = ref(0)
const users = ref<SalesUserOption[]>([])
const firstSalesDepartments = ref<RefundFirstSalesDepartmentOption[]>([])
const activeCase = ref<RefundCaseItem | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]

const filters = reactive<RefundCaseFilters>({
  status: '',
  sourceStage: '',
})

const reviewDialogVisible = ref(false)
const assignDialogVisible = ref(false)
const followDialogVisible = ref(false)
const closeDialogVisible = ref(false)
const creatingDialogVisible = ref(false)
const departmentDialogVisible = ref(false)

const reviewForm = reactive<ReviewRefundCasePayload>({
  action: 'APPROVE',
  remark: '',
})

const assignForm = reactive<AssignRefundCasePayload>({
  assigneeId: 0,
  remark: '',
})

const followForm = reactive<FollowRefundCasePayload>({
  content: '',
  remark: '',
})

const closeForm = reactive<CloseRefundCasePayload>({
  remark: '',
})

const departmentForm = reactive<{ firstSalesDepartmentId?: number }>({
  firstSalesDepartmentId: undefined,
})

const selectedDepartmentOption = computed(() => firstSalesDepartments.value.find((item) => item.id === departmentForm.firstSalesDepartmentId))

const statusOptions = [
  { label: '待主管审批', value: 'PENDING_REVIEW' },
  { label: '待分配处理人', value: 'PENDING_ASSIGNMENT' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '已完结', value: 'CLOSED' },
]

const sourceStageOptions = [
  { label: '客户列表', value: 'CUSTOMER' },
  { label: '一销', value: 'FIRST_SALES' },
  { label: '二销', value: 'SECOND_SALES' },
  { label: '法务', value: 'LEGAL' },
  { label: '调解', value: 'MEDIATION' },
  { label: '三销', value: 'THIRD_SALES' },
]

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const loadDepartmentOptions = async () => {
  if (!canViewRefundDepartments()) {
    firstSalesDepartments.value = []
    return
  }
  departmentLoading.value = true
  try {
    firstSalesDepartments.value = await fetchRefundFirstSalesDepartments()
  } finally {
    departmentLoading.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const requests: Array<Promise<unknown>> = [fetchRefundCases({ ...filters, page: currentPage.value, pageSize: pageSize.value }), fetchRefundUsers()]
    if (canViewRefundDepartments()) {
      requests.push(fetchRefundFirstSalesDepartments())
    }
    const [caseResult, userList, departmentList] = await Promise.all(requests)
    cases.value = (caseResult as { items: RefundCaseItem[]; total: number }).items
    total.value = (caseResult as { items: RefundCaseItem[]; total: number }).total
    users.value = userList as SalesUserOption[]
    firstSalesDepartments.value = (departmentList as RefundFirstSalesDepartmentOption[] | undefined) || []

    if (activeCase.value) {
      const matched = cases.value.find((item) => item.id === activeCase.value?.id)
      if (matched) {
        activeCase.value = await fetchRefundCaseDetail(matched.id)
      } else {
        activeCase.value = cases.value[0] ? await fetchRefundCaseDetail(cases.value[0].id) : null
      }
    } else if (cases.value[0]) {
      activeCase.value = await fetchRefundCaseDetail(cases.value[0].id)
    } else {
      activeCase.value = null
    }
  } finally {
    loading.value = false
  }
}

const selectCase = async (item: RefundCaseItem | null) => {
  if (!item) {
    activeCase.value = null
    return
  }
  activeCase.value = await fetchRefundCaseDetail(item.id)
}

const resetReviewForm = () => {
  reviewForm.action = 'APPROVE'
  reviewForm.remark = ''
}

const resetAssignForm = () => {
  assignForm.assigneeId = 0
  assignForm.remark = ''
}

const resetFollowForm = () => {
  followForm.content = ''
  followForm.remark = ''
}

const resetCloseForm = () => {
  closeForm.remark = ''
}

const resetDepartmentForm = () => {
  departmentForm.firstSalesDepartmentId = activeCase.value?.firstSalesDepartmentId
}

const submitCreateSuccess = async () => {
  await loadData()
}

const removeCase = async (item: RefundCaseItem) => {
  await ElMessageBox.confirm(`确认删除退款单 #${item.id} 吗？删除后不可恢复。`, '删除退款单', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  saving.value = true
  try {
    await deleteRefundCase(item.id)
    ElMessage.success('退款单已删除')
    if (activeCase.value?.id === item.id) {
      activeCase.value = null
    }
    await loadData()
  } finally {
    saving.value = false
  }
}

const submitReview = async () => {
  if (!activeCase.value) return
  saving.value = true
  try {
    await reviewRefundCase(activeCase.value.id, { ...reviewForm, remark: reviewForm.remark?.trim() || undefined })
    ElMessage.success(reviewForm.action === 'APPROVE' ? '退款申请已通过' : '退款申请已驳回')
    reviewDialogVisible.value = false
    resetReviewForm()
    await loadData()
  } finally {
    saving.value = false
  }
}

const submitAssign = async () => {
  if (!activeCase.value || !assignForm.assigneeId) {
    ElMessage.warning('请选择处理人')
    return
  }
  saving.value = true
  try {
    await assignRefundCase(activeCase.value.id, { ...assignForm, remark: assignForm.remark?.trim() || undefined })
    ElMessage.success('退款工单已分配')
    assignDialogVisible.value = false
    resetAssignForm()
    await loadData()
  } finally {
    saving.value = false
  }
}

const submitFollow = async () => {
  if (!activeCase.value || !followForm.content.trim()) {
    ElMessage.warning('请输入跟进内容')
    return
  }
  saving.value = true
  try {
    await followRefundCase(activeCase.value.id, {
      content: followForm.content.trim(),
      remark: followForm.remark?.trim() || undefined,
    })
    ElMessage.success('退款跟进已保存')
    followDialogVisible.value = false
    resetFollowForm()
    await loadData()
  } finally {
    saving.value = false
  }
}

const submitClose = async () => {
  if (!activeCase.value) return
  saving.value = true
  try {
    await closeRefundCase(activeCase.value.id, { remark: closeForm.remark?.trim() || undefined })
    ElMessage.success('退款工单已完结')
    closeDialogVisible.value = false
    resetCloseForm()
    await loadData()
  } finally {
    saving.value = false
  }
}

const submitDepartment = async () => {
  if (!activeCase.value) return
  saving.value = true
  try {
    await updateRefundFirstSalesDepartment(activeCase.value.id, { firstSalesDepartmentId: departmentForm.firstSalesDepartmentId })
    ElMessage.success('一销归属已更新')
    departmentDialogVisible.value = false
    await loadData()
  } finally {
    saving.value = false
  }
}

watch(pageSize, async () => {
  currentPage.value = 1
  await loadData()
})

watch(currentPage, async () => {
  await loadData()
})

watch(departmentDialogVisible, async (value) => {
  if (value) {
    if (!firstSalesDepartments.value.length && canViewRefundDepartments()) {
      await loadDepartmentOptions()
    }
    resetDepartmentForm()
  }
})

onMounted(loadData)
</script>

<template>
  <div class="page-stack refund-page">
    <el-card>
      <template #header>
        <div class="card-header-row">
          <span>退款处理</span>
          <el-space wrap>
            <el-select v-model="filters.status" placeholder="退款状态" clearable style="width: 160px" @change="loadData">
              <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-select v-model="filters.sourceStage" placeholder="来源阶段" clearable style="width: 160px" @change="loadData">
              <el-option v-for="item in sourceStageOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-button v-if="canCreateRefund()" type="primary" @click="creatingDialogVisible = true">新建退款单</el-button>
          </el-space>
        </div>
      </template>

      <div class="refund-layout">
        <el-card shadow="never" class="refund-list-card">
          <template #header>
            <div class="card-header-row">
              <span>退款单列表</span>
              <span class="table-caption">点击左侧列表可查看详情</span>
            </div>
          </template>

          <el-table v-loading="loading" :data="cases" highlight-current-row @row-click="selectCase" @current-change="selectCase">
            <el-table-column label="工单ID" prop="id" min-width="90" />
            <el-table-column label="客户编号" prop="customerNo" min-width="130" />
            <el-table-column label="客户姓名" prop="customerName" min-width="120" />
            <el-table-column label="手机号" min-width="130">
              <template #default="scope">{{ formatPhone(scope.row.phone, scope.row) }}</template>
            </el-table-column>
            <el-table-column label="一销团队" prop="firstSalesTeamName" min-width="140" />
            <el-table-column label="一销部门" prop="firstSalesDepartmentName" min-width="160" />
            <el-table-column label="来源阶段" prop="sourceStageLabel" min-width="120" />
            <el-table-column label="退款状态" prop="statusLabel" min-width="140" />
            <el-table-column label="申请人" prop="requestedByName" min-width="120" />
            <el-table-column label="处理人" prop="assigneeName" min-width="120" />
            <el-table-column label="创建时间" min-width="180">
              <template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template>
            </el-table-column>
            <el-table-column v-if="canDeleteRefund()" label="删除" width="72" fixed="right">
              <template #default="scope">
                <el-tooltip content="删除退款单" placement="top">
                  <el-button link type="danger" :icon="Delete" :loading="saving && activeCase?.id === scope.row.id" @click.stop="removeCase(scope.row)" />
                </el-tooltip>
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

        <el-card shadow="never" class="refund-detail-card">
          <template #header>
            <div class="card-header-row">
              <span>退款单详情</span>
              <el-space wrap>
                <el-button v-if="canEditRefundDepartment() && activeCase" type="primary" link @click="departmentDialogVisible = true">修改一销归属</el-button>
                <el-button v-if="canReviewRefund() && activeCase?.status === 'PENDING_REVIEW'" type="primary" link @click="reviewDialogVisible = true">审批</el-button>
                <el-button v-if="canAssignRefund() && ['PENDING_ASSIGNMENT', 'PROCESSING'].includes(activeCase?.status || '')" type="warning" link @click="assignDialogVisible = true">分配</el-button>
                <el-button v-if="canEditRefund() && activeCase?.status === 'PROCESSING'" type="success" link @click="followDialogVisible = true">跟进</el-button>
                <el-button v-if="canCloseRefund() && activeCase?.status === 'PROCESSING'" type="danger" link @click="closeDialogVisible = true">完结</el-button>
              </el-space>
            </div>
          </template>

          <template v-if="activeCase">
            <div class="page-stack-sm">
              <el-descriptions :column="3" border>
                <el-descriptions-item label="工单ID">{{ activeCase.id }}</el-descriptions-item>
                <el-descriptions-item label="退款状态">{{ activeCase.statusLabel }}</el-descriptions-item>
                <el-descriptions-item label="来源阶段">{{ activeCase.sourceStageLabel }}</el-descriptions-item>
                <el-descriptions-item label="客户姓名">{{ activeCase.customerName }}</el-descriptions-item>
                <el-descriptions-item label="手机号">{{ formatPhone(activeCase.phone) }}</el-descriptions-item>
                <el-descriptions-item label="申请人">{{ activeCase.requestedByName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="一销团队">{{ activeCase.firstSalesTeamName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="一销部门">{{ activeCase.firstSalesDepartmentName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="处理人">{{ activeCase.assigneeName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="审批人">{{ activeCase.reviewerName || '-' }}</el-descriptions-item>
                <el-descriptions-item label="期望退款金额">{{ formatCurrency(activeCase.expectedRefundAmount) }}</el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatDateTime(activeCase.createdAt) }}</el-descriptions-item>
                <el-descriptions-item label="退款原因" :span="3">{{ activeCase.reason }}</el-descriptions-item>
                <el-descriptions-item label="申请备注" :span="3">{{ activeCase.remark || '-' }}</el-descriptions-item>
                <el-descriptions-item label="审批备注" :span="3">{{ activeCase.reviewRemark || '-' }}</el-descriptions-item>
              </el-descriptions>

              <el-card shadow="never">
                <template #header>客户信息</template>
                <el-descriptions :column="4" border>
                  <el-descriptions-item label="客户编号">{{ activeCase.customer?.customerNo || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="案件类型">{{ activeCase.customer?.caseType || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="客户来源">{{ activeCase.customer?.source || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="意向等级">{{ activeCase.customer?.intentionLevel || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="一销人员">{{ activeCase.customer?.firstSalesUserName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="客户当前团队">{{ activeCase.customer?.firstSalesTeamName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="二销人员">{{ activeCase.customer?.secondSalesUserName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="法务人员">{{ activeCase.customer?.legalUserName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="三销人员">{{ activeCase.customer?.thirdSalesUserName || '-' }}</el-descriptions-item>
                  <el-descriptions-item label="总回款">{{ formatCurrency(activeCase.customer?.totalPaymentAmount) }}</el-descriptions-item>
                  <el-descriptions-item label="欠款金额">{{ formatCurrency(activeCase.customer?.arrearsAmount) }}</el-descriptions-item>
                </el-descriptions>
              </el-card>

              <el-card shadow="never">
                <template #header>处理日志</template>
                <el-timeline>
                  <el-timeline-item v-for="item in activeCase.logs" :key="item.id" :timestamp="formatDateTime(item.createdAt)">
                    <div class="log-title">{{ item.operatorName || '-' }}</div>
                    <div>{{ item.content }}</div>
                  </el-timeline-item>
                </el-timeline>
              </el-card>
            </div>
          </template>
          <el-empty v-else description="请选择退款单" />
        </el-card>
      </div>
    </el-card>

    <RefundCreateDialog v-model:visible="creatingDialogVisible" @success="submitCreateSuccess" />

    <el-dialog v-model="departmentDialogVisible" title="修改一销归属" width="520px">
      <el-form label-width="100px">
        <el-form-item label="一销部门">
          <el-select v-model="departmentForm.firstSalesDepartmentId" clearable filterable :loading="departmentLoading" style="width: 100%">
            <el-option v-for="item in firstSalesDepartments" :key="item.id" :label="`${item.name}${item.teamName ? `（团队：${item.teamName}）` : ''}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="一销团队">
          <div class="static-text">{{ selectedDepartmentOption?.teamName || '-' }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="departmentDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitDepartment">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="reviewDialogVisible" title="审批退款单" width="520px">
      <el-form label-width="100px">
        <el-form-item label="审批动作">
          <el-radio-group v-model="reviewForm.action">
            <el-radio label="APPROVE">通过</el-radio>
            <el-radio label="REJECT">驳回</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="审批备注">
          <el-input v-model="reviewForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitReview">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assignDialogVisible" title="分配处理人" width="520px">
      <el-form label-width="100px">
        <el-form-item label="处理人">
          <el-select v-model="assignForm.assigneeId" style="width: 100%">
            <el-option v-for="user in users" :key="user.id" :label="`${user.realName}（${user.roleName}）`" :value="user.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="assignForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAssign">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="followDialogVisible" title="退款跟进" width="520px">
      <el-form label-width="100px">
        <el-form-item label="跟进内容">
          <el-input v-model="followForm.content" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="followForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="followDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitFollow">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="closeDialogVisible" title="完结退款单" width="520px">
      <el-form label-width="100px">
        <el-form-item label="完结备注">
          <el-input v-model="closeForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitClose">确认完结</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.refund-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(360px, 0.85fr);
  gap: 14px;
}

.refund-list-card,
.refund-detail-card {
  min-width: 0;
}

.table-caption {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.log-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.static-text {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}
</style>
