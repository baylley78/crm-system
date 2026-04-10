<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import { authStorage } from '../../auth'
import { fetchDepartmentTree } from '../../api/departments'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { batchReviewFirstSalesOrders, deleteFirstSalesOrder, fetchFirstSalesOrders } from '../../api/first-sales'
import type { BatchFinanceReviewPayload, CustomerItem, DepartmentTreeItem, FirstSalesListItem } from '../../types'
import CustomerTailPaymentDrawer from '../customers/CustomerTailPaymentDrawer.vue'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'
import FirstSalesCreateDrawer from './FirstSalesCreateDrawer.vue'

const loading = ref(false)
const actionLoading = ref(false)
const reviewLoading = ref(false)
const refundSubmittingId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const orders = ref<FirstSalesListItem[]>([])
const departmentOptions = ref<Array<{ id: number; name: string }>>([])
const total = ref(0)
const createDrawerVisible = ref(false)
const createDrawerRef = ref<InstanceType<typeof FirstSalesCreateDrawer> | null>(null)
const tailPaymentDrawerVisible = ref(false)
const filtersCollapsed = ref(true)
const orderTableRef = ref()
const tailPaymentDrawerRef = ref<InstanceType<typeof CustomerTailPaymentDrawer> | null>(null)
const selectedOrderIds = ref<number[]>([])
const screenshotPreviewVisible = ref(false)
const screenshotPreviewUrl = ref('')
const screenshotPreviewFailed = ref(false)
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]
const filters = ref({
  name: '',
  phone: '',
  salesUserName: '',
  orderType: '',
  paymentStatus: '',
  currentStatus: '',
  paymentAccountName: '',
  paymentSerialNo: '',
  tailPaymentSerialNo: '',
  departmentId: '',
  financeReviewStatus: '',
  timeRange: [] as string[],
})

const flattenDepartments = (items: DepartmentTreeItem[], prefix = ''): Array<{ id: number; name: string }> =>
  items.flatMap((item) => {
    const label = prefix ? `${prefix} / ${item.name}` : item.name
    return [{ id: item.id, name: label }, ...flattenDepartments(item.children || [], label)]
  })

const orderTypeOptions = ['定金', '尾款', '全款']
const paymentStatusOptions = ['已付清', '部分付款']
const financeReviewPartitionOptions = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
]

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const getPaymentTagType = (value: string) => (value === '已付清' ? 'success' : 'warning')
const getStatusTagType = (value: string) => (value === '待补尾款' ? 'danger' : 'info')
const getFinanceReviewTagType = (status: FirstSalesListItem['financeReviewStatus']) => {
  if (status === 'APPROVED') {
    return 'success'
  }
  if (status === 'REJECTED') {
    return 'danger'
  }
  return 'warning'
}
const getRowClassName = ({ row }: { row: FirstSalesListItem }) => (row.financeReviewStatus === 'PENDING' ? '' : 'reviewed-row')
const currentReviewerId = computed(() => authStorage.getUser()?.id || 0)
const selectedPendingOrders = computed(() => orders.value.filter((item) => selectedOrderIds.value.includes(item.id) && item.financeReviewStatus === 'PENDING'))

const canCreateFirstSales = () => hasPermission('firstSales.create')
const canEditFirstSales = () => hasPermission('firstSales.edit')
const canTailFirstSales = () => hasPermission('firstSales.tail')
const canBatchReviewFirstSales = () => hasPermission('firstSales.review.batch')
const canExportFirstSales = () => hasPermission('firstSales.export')
const canDeleteFirstSales = () => hasPermission('firstSales.delete')
const canCreateRefund = () => hasPermission('refund.create')

const loadOrders = async () => {
  loading.value = true
  try {
    const result = await fetchFirstSalesOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
      customerName: filters.value.name || undefined,
      phone: filters.value.phone || undefined,
      firstSalesUserName: filters.value.salesUserName || undefined,
      paymentAccountName: filters.value.paymentAccountName || undefined,
      paymentSerialNo: filters.value.paymentSerialNo || undefined,
      tailPaymentSerialNo: filters.value.tailPaymentSerialNo || undefined,
      paymentStatus: filters.value.paymentStatus === '已付清' ? 'PAID' : filters.value.paymentStatus === '部分付款' ? 'PARTIAL' : undefined,
      departmentId: filters.value.departmentId || undefined,
      financeReviewStatus: filters.value.financeReviewStatus || undefined,
      startTime: filters.value.timeRange[0] || undefined,
      endTime: filters.value.timeRange[1] || undefined,
    })
    orders.value = result.items
    total.value = result.total
  } finally {
    loading.value = false
  }
}

const openCreateDrawer = () => {
  createDrawerVisible.value = true
}

const openEditDrawer = async (order: FirstSalesListItem) => {
  createDrawerVisible.value = true
  await createDrawerRef.value?.openForEdit(order)
}

const loadDepartments = async () => {
  if (!hasPermission('system.departments.view')) {
    departmentOptions.value = []
    return
  }
  departmentOptions.value = flattenDepartments(await fetchDepartmentTree())
}

const resetFilters = () => {
  filters.value.name = ''
  filters.value.phone = ''
  filters.value.salesUserName = ''
  filters.value.orderType = ''
  filters.value.paymentStatus = ''
  filters.value.currentStatus = ''
  filters.value.paymentAccountName = ''
  filters.value.paymentSerialNo = ''
  filters.value.tailPaymentSerialNo = ''
  filters.value.departmentId = ''
  filters.value.financeReviewStatus = ''
  filters.value.timeRange = []
  currentPage.value = 1
  loadOrders()
}

const hasActiveFilters = computed(() =>
  Boolean(
    filters.value.name ||
    filters.value.phone ||
    filters.value.salesUserName ||
    filters.value.orderType ||
    filters.value.paymentStatus ||
    filters.value.currentStatus ||
    filters.value.paymentAccountName ||
    filters.value.paymentSerialNo ||
    filters.value.tailPaymentSerialNo ||
    filters.value.departmentId ||
    filters.value.financeReviewStatus ||
    filters.value.timeRange.length,
  ),
)

const applyPendingTailFilter = () => {
  filters.value.paymentStatus = '部分付款'
  filters.value.currentStatus = '待补尾款'
  filters.value.financeReviewStatus = 'PENDING'
  currentPage.value = 1
  loadOrders()
}

const applyPaidFilter = () => {
  filters.value.paymentStatus = '已付清'
  filters.value.currentStatus = ''
  currentPage.value = 1
  loadOrders()
}

const applyFinancePartition = (status: string) => {
  filters.value.financeReviewStatus = status
  currentPage.value = 1
  loadOrders()
}

const markCustomerListForRefresh = () => {
  localStorage.setItem('crm_customers_refresh_at', String(Date.now()))
  localStorage.removeItem('crm_customers_refresh_phone')
}

const handleCreateUpdated = async () => {
  await loadOrders()
}

const mapOrderToCustomer = (order: FirstSalesListItem): CustomerItem => ({
  id: order.customerId,
  customerNo: order.customerNo,
  name: order.name,
  phone: order.phone,
  wechat: order.wechat,
  province: order.province,
  city: order.city,
  source: order.source,
  caseType: order.caseType,
  intentionLevel: order.intentionLevel,
  currentStatus: order.currentStatus as CustomerItem['currentStatus'],
  firstSalesUserName: order.salesUserName,
  targetAmount: order.targetAmount || 0,
  firstPaymentAmount: order.paymentAmount,
  secondPaymentAmount: 0,
  thirdPaymentAmount: 0,
  totalPaymentAmount: order.paymentAmount,
  arrearsAmount: order.arrearsAmount,
  isTailPaymentCompleted: order.paymentStatus === '已付清',
  isTimelyDeal: order.isTimelyDeal,
  createdAt: order.createdAt,
  updatedAt: order.createdAt,
})

const canRecordTailPayment = (order: FirstSalesListItem) => order.paymentStatus !== '已付清' && order.currentStatus === '待补尾款'
const canTransferToSecondSales = (order: FirstSalesListItem) =>
  order.currentStatus === '待分配二销' && (order.orderType === '尾款' || order.orderType === '全款')

const openTailPayment = async (order: FirstSalesListItem) => {
  tailPaymentDrawerVisible.value = true
  await tailPaymentDrawerRef.value?.openForCustomer(mapOrderToCustomer(order))
}

const quickCreateRefund = async (order: FirstSalesListItem) => {
  refundSubmittingId.value = order.id
  refundDraft.value = {
    customerId: order.customerId,
    customerName: order.name,
    phone: order.phone,
    sourceStage: 'FIRST_SALES',
    relatedOrderId: order.id,
    relatedOrderStage: 'FIRST',
    firstSalesUserId: order.salesUserId,
    firstSalesUserName: order.salesUserName,
    firstSalesDepartmentId: order.firstSalesDepartmentId,
    reason: `客户在一销阶段申请退款，当前状态：${order.currentStatus}`,
    remark: order.remark || '',
    expectedRefundAmount: Number(order.paymentAmount || 0),
  }
  refundDialogVisible.value = true
  refundSubmittingId.value = null
}

const handleTailPaymentUpdated = async () => {
  markCustomerListForRefresh()
  await loadOrders()
}

const openScreenshotPreview = (url?: string) => {
  if (!url) {
    return
  }

  screenshotPreviewFailed.value = false
  screenshotPreviewUrl.value = toAbsoluteFileUrl(url)
  screenshotPreviewVisible.value = true
}

const handleTransferToSecondSales = async () => {
  markCustomerListForRefresh()
  ElMessage.success('已转入二销接待，请到二销接待查看')
  await loadOrders()
}

const handleDeleteOrder = async (order: FirstSalesListItem) => {
  await ElMessageBox.confirm(`确认删除一销业绩“${order.name}”吗？删除后仅移除当前一销业绩记录。`, '删除一销业绩', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  actionLoading.value = true
  try {
    await deleteFirstSalesOrder(order.id)
    markCustomerListForRefresh()
    ElMessage.success('一销业绩已删除')
    await loadOrders()
  } finally {
    actionLoading.value = false
  }
}

const handleSelectionChange = (rows: FirstSalesListItem[]) => {
  selectedOrderIds.value = rows.map((item) => item.id)
}

const handleBatchDeleteOrders = async () => {
  if (!selectedOrderIds.value.length) {
    ElMessage.warning('请先选择业绩')
    return
  }

  await ElMessageBox.confirm(`确认批量删除已选 ${selectedOrderIds.value.length} 条一销业绩吗？删除后仅移除所选业绩记录。`, '批量删除一销业绩', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  actionLoading.value = true
  try {
    await Promise.all(selectedOrderIds.value.map((orderId) => deleteFirstSalesOrder(orderId)))
    markCustomerListForRefresh()
    ElMessage.success('批量删除业绩成功')
    selectedOrderIds.value = []
    orderTableRef.value?.clearSelection()
    await loadOrders()
  } finally {
    actionLoading.value = false
  }
}

const handleBatchFinanceReview = async (action: BatchFinanceReviewPayload['action']) => {
  if (!currentReviewerId.value) {
    ElMessage.warning('未获取到当前审核人信息')
    return
  }

  if (!selectedPendingOrders.value.length) {
    ElMessage.warning('请先选择待审核订单')
    return
  }

  const actionLabel = action === 'APPROVE' ? '通过' : '驳回'
  const remark = await ElMessageBox.prompt(`请输入批量${actionLabel}备注（可选）`, `批量${actionLabel}`, {
    inputPlaceholder: `可填写批量${actionLabel}备注`,
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputValue: '',
  }).then((result) => result.value).catch(() => undefined)

  if (remark === undefined) {
    return
  }

  reviewLoading.value = true
  try {
    await batchReviewFirstSalesOrders({
      orderIds: selectedPendingOrders.value.map((item) => item.id),
      action,
      reviewerId: currentReviewerId.value,
      remark: remark || undefined,
    })
    ElMessage.success(`批量${actionLabel}成功`)
    selectedOrderIds.value = []
    orderTableRef.value?.clearSelection()
    await loadOrders()
  } finally {
    reviewLoading.value = false
  }
}

const exportOrders = () => {
  if (!orders.value.length) {
    ElMessage.warning('当前没有可导出的业绩数据')
    return
  }

  const sheetRows = orders.value.map((item) => ({
    客户编号: item.customerNo,
    客户姓名: item.name,
    手机号码: formatPhone(item.phone, item),
    一销团队: item.firstSalesTeamName || '',
    一销部门: item.firstSalesDepartmentName || '',
    一销人员: item.salesUserName,
    成交类型: item.orderType,
    及时成交: item.isTimelyDeal ? '是' : '否',
    合同金额: item.contractAmount,
    付款金额: item.paymentAmount,
    欠款金额: item.arrearsAmount,
    案件类型: item.caseType || '',
    意向等级: item.intentionLevel || '',
    标的金额: item.targetAmount || 0,
    收款账户: item.paymentAccountName || '',
    付款单号: item.paymentSerialNo || '',
    付款状态: item.paymentStatus,
    财务审核: item.financeReviewStatusLabel,
    审核人: item.financeReviewerName || '',
    审核时间: formatDateTime(item.financeReviewedAt),
    审核备注: item.financeReviewRemark || '',
    客户状态: item.currentStatus,
    客户情况说明: item.remark || '',
    录入时间: formatDateTime(item.createdAt),
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '一销业绩')
  XLSX.writeFile(workbook, '一销业绩订单.xlsx')
}

watch(pageSize, () => {
  currentPage.value = 1
  loadOrders()
})

watch(currentPage, () => {
  loadOrders()
})

onMounted(async () => {
  await loadDepartments()
  await loadOrders()
})
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>一销业绩列表</template>

      <div class="page-stack">
        <el-card shadow="never">
          <template #header>
            <div class="card-header-row">
              <span>筛选条件</span>
              <el-button link type="primary" @click="filtersCollapsed = !filtersCollapsed">
                {{ filtersCollapsed ? '展开' : '收起' }}
              </el-button>
            </div>
          </template>
          <div v-show="!filtersCollapsed" class="page-stack-sm">
            <div>
              <el-space wrap>
                <el-button @click="applyPendingTailFilter">只看待补尾款</el-button>
                <el-button @click="applyPaidFilter">只看已付清</el-button>
                <el-button @click="applyFinancePartition('PENDING')">待审核</el-button>
                <el-button @click="applyFinancePartition('APPROVED')">已通过</el-button>
                <el-button @click="applyFinancePartition('REJECTED')">已驳回</el-button>
                <el-button @click="applyFinancePartition('')">全部审核</el-button>
                <el-button @click="resetFilters">清空快捷筛选</el-button>
              </el-space>
            </div>
            <el-form inline>
              <el-form-item label="客户姓名">
                <el-input v-model="filters.name" placeholder="请输入客户姓名" clearable />
              </el-form-item>
              <el-form-item label="手机号码">
                <el-input v-model="filters.phone" placeholder="请输入手机号" clearable />
              </el-form-item>
              <el-form-item label="一销人员">
                <el-input v-model="filters.salesUserName" placeholder="请输入一销人员" clearable />
              </el-form-item>
              <el-form-item label="收款账户">
                <el-input v-model="filters.paymentAccountName" placeholder="请输入收款账户" clearable />
              </el-form-item>
              <el-form-item label="付款单号">
                <el-input v-model="filters.paymentSerialNo" placeholder="请输入付款单号" clearable />
              </el-form-item>
              <el-form-item label="部门">
                <el-select v-model="filters.departmentId" placeholder="全部部门" clearable filterable style="width: 180px">
                  <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="String(item.id)" />
                </el-select>
              </el-form-item>
              <el-form-item label="时间范围">
                <el-date-picker
                  v-model="filters.timeRange"
                  type="datetimerange"
                  range-separator="至"
                  start-placeholder="开始时间"
                  end-placeholder="结束时间"
                  value-format="YYYY-MM-DDTHH:mm:ss"
                />
              </el-form-item>
              <el-form-item label="审核分区">
                <el-segmented v-model="filters.financeReviewStatus" :options="financeReviewPartitionOptions" />
              </el-form-item>
              <el-form-item label="成交类型">
                <el-select v-model="filters.orderType" placeholder="全部" clearable style="width: 140px">
                  <el-option v-for="item in orderTypeOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="付款状态">
                <el-select v-model="filters.paymentStatus" placeholder="全部" clearable style="width: 140px">
                  <el-option v-for="item in paymentStatusOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="客户状态">
                <el-input v-model="filters.currentStatus" placeholder="请输入客户状态" clearable />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadOrders">搜索</el-button>
                <el-button @click="resetFilters">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>业绩订单列表</template>
          <div class="page-stack-sm">
            <el-alert title="这里固定展示已产生过的一销订单，客户后续流转到二销、法务、调解或三销后，历史订单仍会保留在列表中。" type="info" :closable="false" show-icon />
            <el-alert v-if="hasActiveFilters" title="当前已启用筛选条件，若看不到历史订单请先点击“重置”或“清空快捷筛选”。" type="warning" :closable="false" show-icon />
            <el-alert v-if="filters.financeReviewStatus === 'PENDING'" title="当前仅显示待审核订单。" type="warning" :closable="false" show-icon />
            <el-alert v-else-if="filters.financeReviewStatus === 'APPROVED'" title="当前仅显示已通过订单。" type="success" :closable="false" show-icon />
            <el-alert v-else-if="filters.financeReviewStatus === 'REJECTED'" title="当前仅显示已驳回订单。" type="error" :closable="false" show-icon />
            <el-alert title="列表已按 待补尾款优先 → 最新录入优先 排序" type="warning" :closable="false" show-icon />
            <el-space wrap>
              <el-button v-if="canCreateFirstSales()" type="primary" @click="openCreateDrawer">录入业绩</el-button>
              <el-button v-if="canExportFirstSales()" @click="exportOrders">导出Excel</el-button>
              <el-button v-if="canBatchReviewFirstSales()" type="success" :loading="reviewLoading" @click="handleBatchFinanceReview('APPROVE')">批量通过</el-button>
              <el-button v-if="canBatchReviewFirstSales()" type="warning" :loading="reviewLoading" @click="handleBatchFinanceReview('REJECT')">批量驳回</el-button>
              <el-button v-if="canDeleteFirstSales()" type="danger" :loading="actionLoading" @click="handleBatchDeleteOrders">批量删除业绩</el-button>
            </el-space>
            <el-table ref="orderTableRef" v-loading="loading" :data="orders" :row-class-name="getRowClassName" @selection-change="handleSelectionChange">
              <el-table-column type="selection" width="55" />
              <el-table-column label="录单时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.createdAt) }}
                </template>
              </el-table-column>
              <el-table-column label="客户姓名" prop="name" min-width="120" />
              <el-table-column label="手机号码" min-width="130">
                <template #default="scope">
                  {{ formatPhone(scope.row.phone, scope.row) }}
                </template>
              </el-table-column>
              <el-table-column label="一销团队/部门" min-width="200">
                <template #default="scope">
                  {{ scope.row.firstSalesTeamName || '-' }} / {{ scope.row.firstSalesDepartmentName || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="成交类型" prop="orderType" min-width="100" />
              <el-table-column label="及时成交" min-width="100">
                <template #default="scope">
                  <el-tag :type="scope.row.isTimelyDeal ? 'success' : 'danger'">{{ scope.row.isTimelyDeal ? '是' : '否' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="合同金额" prop="contractAmount" min-width="120" />
              <el-table-column label="付款金额" prop="paymentAmount" min-width="120" />
              <el-table-column label="欠款金额" prop="arrearsAmount" min-width="120" />
              <el-table-column label="案件类型" prop="caseType" min-width="120" />
              <el-table-column label="意向等级" prop="intentionLevel" min-width="100" />
              <el-table-column label="标的金额" prop="targetAmount" min-width="120" />
              <el-table-column label="收款账户" min-width="180">
                <template #default="scope">
                  {{ scope.row.paymentAccountName || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="付款单号" min-width="160">
                <template #default="scope">
                  {{ scope.row.paymentSerialNo || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="付款截图" min-width="120">
                <template #default="scope">
                  <el-button v-if="scope.row.paymentScreenshotUrl" link type="primary" @click="openScreenshotPreview(scope.row.paymentScreenshotUrl)">
                    查看截图
                  </el-button>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="付款状态" min-width="120">
                <template #default="scope">
                  <el-tag :type="getPaymentTagType(scope.row.paymentStatus)">{{ scope.row.paymentStatus }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="财务审核" min-width="120">
                <template #default="scope">
                  <el-tag :type="getFinanceReviewTagType(scope.row.financeReviewStatus)">{{ scope.row.financeReviewStatusLabel }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="审核人" prop="financeReviewerName" min-width="120" />
              <el-table-column label="审核时间" min-width="180">
                <template #default="scope">
                  {{ formatDateTime(scope.row.financeReviewedAt) }}
                </template>
              </el-table-column>
              <el-table-column label="审核备注" prop="financeReviewRemark" min-width="180" show-overflow-tooltip />
              <el-table-column label="客户状态" min-width="140">
                <template #default="scope">
                  <el-tag :type="getStatusTagType(scope.row.currentStatus)">{{ scope.row.currentStatus }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="一销人员" prop="salesUserName" min-width="120" />
              <el-table-column label="客户情况说明" prop="remark" min-width="180" show-overflow-tooltip />
              <el-table-column label="客户编号" prop="customerNo" min-width="140" />
              <el-table-column label="操作" fixed="right" width="280">
                <template #default="scope">
                  <div class="action-cell compact-action-cell">
                    <el-button v-if="canEditFirstSales()" link type="primary" @click="openEditDrawer(scope.row)">编辑</el-button>
                    <el-button v-if="canTailFirstSales() && canRecordTailPayment(scope.row)" link type="warning" @click="openTailPayment(scope.row)">补录尾款</el-button>
                    <el-button v-if="canCreateRefund()" link type="danger" :loading="refundSubmittingId === scope.row.id" @click="quickCreateRefund(scope.row)">申请退款</el-button>
                    <el-button v-if="canTransferToSecondSales(scope.row)" link type="primary" @click="handleTransferToSecondSales">转入二销</el-button>
                    <el-tooltip v-if="canDeleteFirstSales()" content="删除一销业绩" placement="top">
                      <el-button link type="danger" :icon="Delete" @click="handleDeleteOrder(scope.row)" />
                    </el-tooltip>
                  </div>
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
          </div>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="screenshotPreviewVisible" title="付款截图" width="720px">
      <div v-if="screenshotPreviewUrl" class="page-stack-sm">
        <img
          v-if="!screenshotPreviewFailed"
          :src="screenshotPreviewUrl"
          alt="付款截图"
          class="payment-screenshot-preview"
          @error="screenshotPreviewFailed = true"
        />
        <el-empty v-else description="付款截图加载失败，请检查上传文件是否存在" />
      </div>
    </el-dialog>

    <FirstSalesCreateDrawer ref="createDrawerRef" v-model:visible="createDrawerVisible" @updated="handleCreateUpdated" />
    <CustomerTailPaymentDrawer ref="tailPaymentDrawerRef" v-model:visible="tailPaymentDrawerVisible" @updated="handleTailPaymentUpdated" />
    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadOrders" />
  </div>
</template>

<style scoped>
:deep(.reviewed-row) {
  opacity: 0.6;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
}

.compact-action-cell :deep(.el-button) {
  padding: 2px 4px;
  font-size: 12px;
  margin-left: 0;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.payment-screenshot-preview {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: 0 auto;
  border-radius: 8px;
}

.delete-icon-button {
  width: 24px;
  height: 24px;
}
</style>
