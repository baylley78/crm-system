<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { assignSecondSales, fetchSecondSalesAssignments, fetchSecondSalesUsers, transferToMediation } from '../../api/second-sales'
import type { SalesUserOption, SecondSalesAssignmentItem } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'
import SecondSalesOrderDrawer from './SecondSalesOrderDrawer.vue'

const loading = ref(false)
const customers = ref<SecondSalesAssignmentItem[]>([])
const users = ref<SalesUserOption[]>([])
const refundingId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const activeTab = ref('pending')
const orderDrawerVisible = ref(false)
const orderDrawerRef = ref<InstanceType<typeof SecondSalesOrderDrawer> | null>(null)
const assignDialogVisible = ref(false)
const assignSubmitting = ref(false)
const assigningCustomer = ref<SecondSalesAssignmentItem | null>(null)
const dialogSelectedUserId = ref<number | null>(null)
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]

const canAssignSecondSales = () => hasPermission('secondSales.assign')
const canTransferSecondSales = () => hasPermission('secondSales.transfer')
const canCreateSecondSales = () => hasPermission('secondSales.create')
const canCreateRefund = () => hasPermission('refund.create')

const isPendingStatus = (status: string) => status === '待分配二销' || status === 'PENDING_SECOND_SALES_ASSIGNMENT'
const isAssignedStatus = (status: string) =>
  status === '二销跟进中' ||
  status === 'SECOND_SALES_FOLLOWING' ||
  status === '待转法务' ||
  status === 'PENDING_LEGAL' ||
  status === '待转调解' ||
  status === 'PENDING_MEDIATION' ||
  status === '调解处理中' ||
  status === 'MEDIATION_PROCESSING' ||
  status === '调解完成' ||
  status === 'MEDIATION_COMPLETED' ||
  status === '待转三销' ||
  status === 'PENDING_THIRD_SALES'
const canSubmitSecondSales = (status: string) =>
  status === '二销跟进中' ||
  status === 'SECOND_SALES_FOLLOWING' ||
  status === '待转调解' ||
  status === 'PENDING_MEDIATION' ||
  status === '调解处理中' ||
  status === 'MEDIATION_PROCESSING' ||
  status === '调解完成' ||
  status === 'MEDIATION_COMPLETED'
const canTransferToMediation = (status: string) => status === '二销跟进中' || status === 'SECOND_SALES_FOLLOWING'
const formatStatus = (status: string) => {
  if (isPendingStatus(status)) {
    return '待分配二销'
  }
  if (status === '二销跟进中' || status === 'SECOND_SALES_FOLLOWING') {
    return '二销跟进中'
  }
  if (status === '待转法务' || status === 'PENDING_LEGAL') {
    return '待转法务'
  }
  if (status === '待转调解' || status === 'PENDING_MEDIATION') {
    return '待转调解'
  }
  if (status === '调解处理中' || status === 'MEDIATION_PROCESSING') {
    return '调解处理中'
  }
  if (status === '待转三销' || status === 'PENDING_THIRD_SALES') {
    return '待转三销'
  }
  if (status === '调解完成' || status === 'MEDIATION_COMPLETED') {
    return '调解完成'
  }
  return status
}

const loadData = async () => {
  loading.value = true
  try {
    const [assignmentList, userList] = await Promise.all([fetchSecondSalesAssignments(), fetchSecondSalesUsers()])
    customers.value = assignmentList as SecondSalesAssignmentItem[]
    users.value = (userList as SalesUserOption[] | undefined) || []
    const hasPendingCustomers = customers.value.some((item) => isPendingStatus(item.currentStatus))
    const hasAssignedCustomers = customers.value.some((item) => isAssignedStatus(item.currentStatus))
    if (hasPendingCustomers) {
      activeTab.value = 'pending'
    } else if (hasAssignedCustomers) {
      activeTab.value = 'assigned'
    }
  } finally {
    loading.value = false
  }
}

const openAssignDialog = (customer: SecondSalesAssignmentItem) => {
  assigningCustomer.value = customer
  dialogSelectedUserId.value = users.value.find((item) => item.realName === customer.secondSalesUserName)?.id || users.value[0]?.id || null
  assignDialogVisible.value = true
}

const submitAssign = async () => {
  if (!assigningCustomer.value) {
    return
  }

  if (!dialogSelectedUserId.value) {
    ElMessage.warning('请选择二销人员')
    return
  }

  assignSubmitting.value = true
  try {
    await assignSecondSales({
      customerId: assigningCustomer.value.id,
      secondSalesUserId: dialogSelectedUserId.value,
      remark: '系统分配',
    })
    ElMessage.success('分配成功')
    assignDialogVisible.value = false
    assigningCustomer.value = null
    dialogSelectedUserId.value = null
    activeTab.value = 'assigned'
    await loadData()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || error?.message || '分配失败')
  } finally {
    assignSubmitting.value = false
  }
}

const openOrderDrawer = async (customer: SecondSalesAssignmentItem) => {
  orderDrawerVisible.value = true
  await orderDrawerRef.value?.openForCustomer(customer)
}

const transferCustomerToMediation = async (customer: SecondSalesAssignmentItem) => {
  await ElMessageBox.confirm(`确认将客户“${customer.name}”转入调解中心吗？`, '转入调解', {
    type: 'warning',
  })
  await transferToMediation({ customerId: customer.id })
  ElMessage.success('已转入调解中心')
  await loadData()
}

const quickCreateRefund = async (customer: SecondSalesAssignmentItem) => {
  refundingId.value = customer.id
  refundDraft.value = {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    sourceStage: 'SECOND_SALES',
    firstSalesUserId: customer.firstSalesUserId,
    firstSalesUserName: customer.firstSalesUserName,
    reason: `客户在二销阶段申请退款，当前状态：${formatStatus(customer.currentStatus)}`,
    remark: customer.remark || '',
  }
  refundDialogVisible.value = true
  refundingId.value = null
}

const handleOrderUpdated = async () => {
  await loadData()
}

const pendingCustomers = computed(() => customers.value.filter((item) => isPendingStatus(item.currentStatus)))
const assignedCustomers = computed(() => customers.value.filter((item) => isAssignedStatus(item.currentStatus)))
const activeCustomers = computed(() => (activeTab.value === 'pending' ? pendingCustomers.value : assignedCustomers.value))
const paginatedCustomers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return activeCustomers.value.slice(start, start + pageSize.value)
})

watch(activeTab, () => {
  currentPage.value = 1
})

watch(activeCustomers, (value) => {
  const totalPages = Math.max(1, Math.ceil(value.length / pageSize.value))
  if (currentPage.value > totalPages) {
    currentPage.value = totalPages
  }
}, { immediate: true })

watch(pageSize, () => {
  currentPage.value = 1
})

onMounted(loadData)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="card-header-row">
          <span>二销接待</span>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane :label="`待接待 (${pendingCustomers.length})`" name="pending" />
        <el-tab-pane :label="`已分配 (${assignedCustomers.length})`" name="assigned" />
      </el-tabs>

      <el-table v-loading="loading" :data="paginatedCustomers">
        <el-table-column label="客户姓名" prop="name" min-width="120" />
        <el-table-column label="手机号码" min-width="140">
          <template #default="scope">
            {{ formatPhone(scope.row.phone, scope.row) }}
          </template>
        </el-table-column>
        <el-table-column label="一销金额" prop="firstPaymentAmount" min-width="120" />
        <el-table-column label="当前状态" min-width="140">
          <template #default="scope">
            {{ formatStatus(scope.row.currentStatus) }}
          </template>
        </el-table-column>
        <el-table-column label="二销所属人" min-width="140">
          <template #default="scope">
            {{ scope.row.secondSalesUserName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.remark || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="scope">
            <div class="action-buttons-wrap">
              <el-button v-if="canAssignSecondSales() && activeTab === 'pending'" type="primary" link size="small" @click="openAssignDialog(scope.row)">分配二销</el-button>
              <el-button v-if="canAssignSecondSales() && activeTab !== 'pending'" type="primary" link size="small" @click="openAssignDialog(scope.row)">重分配</el-button>
              <el-button v-if="canCreateSecondSales()" type="success" link size="small" :disabled="!canSubmitSecondSales(scope.row.currentStatus)" @click="openOrderDrawer(scope.row)">录业绩</el-button>
              <el-button v-if="canCreateRefund()" type="danger" link size="small" :loading="refundingId === scope.row.id" @click="quickCreateRefund(scope.row)">退款</el-button>
              <el-button v-if="canTransferSecondSales()" type="warning" link size="small" :disabled="!canTransferToMediation(scope.row.currentStatus)" @click="transferCustomerToMediation(scope.row)">转调解</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizeOptions"
          :total="activeCustomers.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <el-dialog v-model="assignDialogVisible" title="分配二销" width="420px">
      <el-form label-position="top">
        <el-form-item label="客户">
          <el-input :model-value="assigningCustomer ? `${assigningCustomer.name} / ${formatPhone(assigningCustomer.phone, assigningCustomer)}` : ''" disabled />
        </el-form-item>
        <el-form-item label="分配给谁">
          <el-select v-model="dialogSelectedUserId" placeholder="请选择二销人员" style="width: 100%">
            <el-option v-for="item in users" :key="item.id" :label="item.realName" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="assignSubmitting" @click="submitAssign">确认分配</el-button>
      </template>
    </el-dialog>

    <SecondSalesOrderDrawer ref="orderDrawerRef" v-model:visible="orderDrawerVisible" @updated="handleOrderUpdated" />
    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadData" />
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.action-buttons-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
}

.action-buttons-wrap :deep(.el-button) {
  margin-left: 0;
  padding: 0;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
