<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onActivated, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { fetchCustomers } from '../../api/customers'
import { deleteCustomer } from '../../api/customers'
import type { CustomerFilters, CustomerItem } from '../../types'
import CustomerDetailDrawer from './CustomerDetailDrawer.vue'
import CustomerTailPaymentDrawer from './CustomerTailPaymentDrawer.vue'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'

const canFollowCustomers = () => hasPermission('customers.follow')
const canUpdateCustomerStatus = () => hasPermission('customers.status')
const canCreateRefund = () => hasPermission('refund.create')
const canDeleteCustomers = () => hasPermission('customers.delete')

const route = useRoute()

const loading = ref(false)
const customers = ref<CustomerItem[]>([])
const total = ref(0)
const loadError = ref('')
const drawerVisible = ref(false)
const tailPaymentDrawerVisible = ref(false)
const currentCustomerId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const refundSubmittingId = ref<number | null>(null)
const detailDrawerRef = ref<InstanceType<typeof CustomerDetailDrawer> | null>(null)
const tailPaymentDrawerRef = ref<InstanceType<typeof CustomerTailPaymentDrawer> | null>(null)
const filters = reactive<CustomerFilters>({
  name: '',
  phone: '',
  wechat: '',
  status: '',
  source: '',
  caseType: '',
  intentionLevel: '',
  isTailPaymentCompleted: '',
  hasApprovalRecord: '',
  hasQualityRecord: '',
})

const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]

const statusOptions = [
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

const booleanOptions = [
  { label: '是', value: 'true' },
  { label: '否', value: 'false' },
]

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'

const getTailTagType = (item: CustomerItem) => (item.isTailPaymentCompleted ? 'success' : 'danger')
const getApprovalTagType = (item: CustomerItem) => (item.hasApprovalRecord ? 'success' : 'info')
const getQualityTagType = (item: CustomerItem) => (item.hasQualityRecord ? 'warning' : 'info')
const isFollowOverdue = (value?: string) => {
  if (!value) {
    return false
  }

  return Date.now() - new Date(value).getTime() > 1000 * 60 * 60 * 24 * 3
}

const getFollowTagType = (item: CustomerItem) => {
  if (!item.latestFollowTime) {
    return 'info'
  }

  return isFollowOverdue(item.latestFollowTime) ? 'danger' : 'success'
}

const getFollowTagLabel = (item: CustomerItem) => {
  if (!item.latestFollowTime) {
    return '暂无跟进'
  }

  return isFollowOverdue(item.latestFollowTime) ? '跟进超时' : '跟进正常'
}

const rowClassName = ({ row }: { row: CustomerItem }) => {
  if (isFollowOverdue(row.latestFollowTime)) {
    return 'row-follow-overdue'
  }

  if (!row.isTailPaymentCompleted) {
    return 'row-tail-pending'
  }

  return ''
}

const loadCustomers = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await fetchCustomers({
      ...filters,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    customers.value = result.items
    total.value = result.total
  } catch (error: any) {
    customers.value = []
    total.value = 0
    loadError.value = error?.response?.data?.message || error?.message || '客户数据加载失败'
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

const consumePendingCustomerRefresh = async () => {
  const refreshAt = localStorage.getItem('crm_customers_refresh_at')
  if (!refreshAt) {
    return false
  }

  localStorage.removeItem('crm_customers_refresh_at')
  const refreshPhone = localStorage.getItem('crm_customers_refresh_phone') || ''
  localStorage.removeItem('crm_customers_refresh_phone')

  if (refreshPhone) {
    filters.phone = refreshPhone
  }
  currentPage.value = 1
  await loadCustomers()

  return true
}

watch(
  () => route.query.phone,
  async (phone) => {
    if (typeof phone === 'string' && phone.trim()) {
      filters.phone = phone.trim()
      currentPage.value = 1
      await loadCustomers()
    }
  },
  { immediate: true },
)

const resetFilters = async () => {
  filters.name = ''
  filters.phone = ''
  filters.wechat = ''
  filters.status = ''
  filters.source = ''
  filters.caseType = ''
  filters.intentionLevel = ''
  filters.isTailPaymentCompleted = ''
  filters.hasApprovalRecord = ''
  filters.hasQualityRecord = ''
  currentPage.value = 1
  await loadCustomers()
}

const handleSearch = async () => {
  currentPage.value = 1
  await loadCustomers()
}

const openDetail = async (id: number) => {
  currentCustomerId.value = id
  drawerVisible.value = true
  await detailDrawerRef.value?.loadDetail(id)
}

const openFollowAction = async (id: number) => {
  await openDetail(id)
}

const openTailPayment = async (customer: CustomerItem) => {
  tailPaymentDrawerVisible.value = true
  await tailPaymentDrawerRef.value?.openForCustomer(customer)
}

const quickCreateRefund = async (customer: CustomerItem) => {
  refundSubmittingId.value = customer.id
  refundDraft.value = {
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    sourceStage: 'CUSTOMER',
    reason: `客户在客户列表发起退款申请，当前状态：${customer.currentStatus}`,
    remark: customer.remark || '',
  }
  refundDialogVisible.value = true
  refundSubmittingId.value = null
}

const handleDeleteCustomer = async (customer: CustomerItem) => {
  await ElMessageBox.confirm(`确认删除客户“${customer.name}”吗？删除后该客户的相关业绩与跟进数据也会一并删除。`, '删除客户', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  refundSubmittingId.value = customer.id
  try {
    await deleteCustomer(customer.id)
    ElMessage.success('客户已删除')
    await loadCustomers()
  } finally {
    refundSubmittingId.value = null
  }
}

const canRecordTailPayment = (customer: CustomerItem) => !customer.isTailPaymentCompleted && customer.currentStatus === '待补尾款'

const handleDrawerUpdated = async () => {
  await loadCustomers()
}

watch(pageSize, async () => {
  currentPage.value = 1
  await loadCustomers()
})

watch(currentPage, async () => {
  await loadCustomers()
})

onMounted(async () => {
  const refreshed = await consumePendingCustomerRefresh()
  if (!refreshed && !route.query.phone) {
    await loadCustomers()
  }
})
onActivated(async () => {
  const refreshed = await consumePendingCustomerRefresh()
  if (!refreshed && !route.query.phone && !customers.value.length) {
    await loadCustomers()
  }
})
</script>

<template>
  <div class="page-stack customer-list-view">
    <el-card>
      <template #header>
        <div class="card-header-row">
          <span>客户管理</span>
          <el-space wrap>
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-space>
        </div>
      </template>

      <div class="page-stack-sm">
        <el-card shadow="never">
          <el-form class="filter-form">
            <div class="form-grid">
              <el-form-item label="客户姓名">
                <el-input v-model="filters.name" placeholder="请输入客户姓名" clearable />
              </el-form-item>
              <el-form-item label="手机号码">
                <el-input v-model="filters.phone" placeholder="请输入手机号" clearable />
              </el-form-item>
              <el-form-item label="微信号">
                <el-input v-model="filters.wechat" placeholder="请输入微信号" clearable />
              </el-form-item>
              <el-form-item label="客户来源">
                <el-input v-model="filters.source" placeholder="请输入客户来源" clearable />
              </el-form-item>
              <el-form-item label="案件类型">
                <el-input v-model="filters.caseType" placeholder="请输入案件类型" clearable />
              </el-form-item>
              <el-form-item label="意向等级">
                <el-input v-model="filters.intentionLevel" placeholder="请输入意向等级" clearable />
              </el-form-item>
              <el-form-item label="当前状态">
                <el-select v-model="filters.status" placeholder="请选择状态" clearable>
                  <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="尾款补齐">
                <el-select v-model="filters.isTailPaymentCompleted" placeholder="全部" clearable>
                  <el-option v-for="item in booleanOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="有审批记录">
                <el-select v-model="filters.hasApprovalRecord" placeholder="全部" clearable>
                  <el-option v-for="item in booleanOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="有质检记录">
                <el-select v-model="filters.hasQualityRecord" placeholder="全部" clearable>
                  <el-option v-for="item in booleanOptions" :key="item.value" :label="item.label" :value="item.value" />
                </el-select>
              </el-form-item>
            </div>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="card-header-row">
              <span>客户档案列表</span>
              <span class="table-caption">按跟进状态与尾款优先级排序</span>
            </div>
          </template>
          <el-alert
            v-if="loadError"
            :title="loadError"
            type="error"
            :closable="false"
            show-icon
            class="list-feedback"
          />
          <el-empty
            v-else-if="!loading && !customers.length"
            description="当前没有客户数据，请先到一销管理录入业绩建档"
            class="list-feedback"
          />
          <el-table v-else v-loading="loading" :data="customers" :row-class-name="rowClassName" style="width: 100%">
            <el-table-column label="客户一销成交日期" min-width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.createdAt) }}
              </template>
            </el-table-column>
            <el-table-column label="最后更新时间" min-width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column prop="name" label="客户姓名" min-width="100" />
            <el-table-column label="手机号码" min-width="140">
              <template #default="scope">
                {{ formatPhone(scope.row.phone, scope.row) }}
              </template>
            </el-table-column>
            <el-table-column prop="gender" label="性别" min-width="80" />
            <el-table-column prop="age" label="年龄" min-width="80" />
            <el-table-column prop="caseType" label="案件类型" min-width="120" />
            <el-table-column prop="currentStatus" label="当前状态" min-width="140" />
            <el-table-column label="尾款状态" min-width="110">
              <template #default="scope">
                <el-tag :type="getTailTagType(scope.row)">
                  {{ scope.row.isTailPaymentCompleted ? '已补齐' : '未补齐' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="firstSalesUserName" label="一销人员" min-width="120" />
            <el-table-column label="一销团队" min-width="140">
              <template #default="scope">
                {{ scope.row.firstSalesTeamName || '-' }}
              </template>
            </el-table-column>
            <el-table-column prop="secondSalesUserName" label="二销人员" min-width="120" />
            <el-table-column prop="legalUserName" label="法务人员" min-width="120" />
            <el-table-column prop="thirdSalesUserName" label="三销人员" min-width="120" />
            <el-table-column prop="firstPaymentAmount" label="一销回款" min-width="100" />
            <el-table-column prop="secondPaymentAmount" label="二销回款" min-width="100" />
            <el-table-column prop="thirdPaymentAmount" label="三销回款" min-width="100" />
            <el-table-column prop="totalPaymentAmount" label="总回款" min-width="100" />
            <el-table-column label="当前归属" min-width="140">
              <template #default="scope">
                {{ scope.row.followOwnerName || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="当前跟进阶段" min-width="120">
              <template #default="scope">
                {{ scope.row.followStageLabel || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="跟进状态" min-width="110">
              <template #default="scope">
                <el-tag :type="getFollowTagType(scope.row)">
                  {{ getFollowTagLabel(scope.row) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="最近跟进人" min-width="120">
              <template #default="scope">
                {{ scope.row.latestFollowOperatorName || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="最近跟进时间" min-width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.latestFollowTime) }}
              </template>
            </el-table-column>
            <el-table-column label="最近跟进内容" min-width="220" show-overflow-tooltip>
              <template #default="scope">
                {{ scope.row.latestFollowContent || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="审批记录" min-width="100">
              <template #default="scope">
                <el-tag :type="getApprovalTagType(scope.row)">
                  {{ scope.row.hasApprovalRecord ? '有' : '无' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="质检记录" min-width="100">
              <template #default="scope">
                <el-tag :type="getQualityTagType(scope.row)">
                  {{ scope.row.hasQualityRecord ? '有' : '无' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
            <el-table-column prop="customerNo" label="客户编号" min-width="140" />
            <el-table-column label="操作" fixed="right" width="260">
              <template #default="scope">
                <el-button link type="primary" @click="openDetail(scope.row.id)">查看客户</el-button>
                <el-button v-if="canFollowCustomers()" link type="success" @click="openFollowAction(scope.row.id)">客户跟进</el-button>
                <el-button v-if="canCreateRefund()" link type="danger" :loading="refundSubmittingId === scope.row.id" @click="quickCreateRefund(scope.row)">申请退款</el-button>
                <el-tooltip v-if="canDeleteCustomers()" content="删除客户" placement="top">
                  <el-button link type="danger" :icon="Delete" @click="handleDeleteCustomer(scope.row)" />
                </el-tooltip>
                <el-button v-if="canUpdateCustomerStatus() && canRecordTailPayment(scope.row)" link type="warning" @click="openTailPayment(scope.row)">补录尾款</el-button>
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
      </div>
    </el-card>

    <CustomerDetailDrawer ref="detailDrawerRef" v-model:visible="drawerVisible" @updated="handleDrawerUpdated" />
    <CustomerTailPaymentDrawer ref="tailPaymentDrawerRef" v-model:visible="tailPaymentDrawerVisible" @updated="handleDrawerUpdated" />
    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="handleDrawerUpdated" />
  </div>
</template>

<style scoped>
.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.filter-form :deep(.el-select) {
  width: 100%;
}

.table-caption {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.danger-text {
  color: var(--el-color-danger);
}

:deep(.row-follow-overdue) {
  --el-table-tr-bg-color: var(--el-color-danger-light-9);
}

:deep(.row-tail-pending) {
  --el-table-tr-bg-color: var(--el-color-warning-light-9);
}
</style>
