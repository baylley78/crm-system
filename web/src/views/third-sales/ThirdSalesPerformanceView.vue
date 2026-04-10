<script setup lang="ts">
import { Delete, Document, Picture } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import { authStorage } from '../../auth'
import { toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { batchReviewThirdSalesOrders, deleteThirdSalesOrder, fetchThirdSalesOrders } from '../../api/third-sales'
import type { BatchFinanceReviewPayload, ThirdSalesOrderListItem, ThirdSalesOrderPayload } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'
import ThirdSalesOrderDrawer from './ThirdSalesOrderDrawer.vue'

const canEditThirdSales = () => hasPermission('thirdSales.edit')
const canTailThirdSales = () => hasPermission('thirdSales.create') || hasPermission('thirdSales.edit')
const canBatchReviewThirdSales = () => hasPermission('thirdSales.review.batch')
const canExportThirdSales = () => hasPermission('thirdSales.export')
const canCreateRefund = () => hasPermission('refund.create')
const canDeleteThirdSales = () => hasPermission('thirdSales.delete')

const refundSubmittingId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const orderDrawerVisible = ref(false)
const orderDrawerRef = ref<InstanceType<typeof ThirdSalesOrderDrawer> | null>(null)
const ordersLoading = ref(false)
const reviewLoading = ref(false)
const orders = ref<ThirdSalesOrderListItem[]>([])
const total = ref(0)
const selectedOrderIds = ref<number[]>([])
const orderTableRef = ref()
const previewVisible = ref(false)
const previewTitle = ref('附件预览')
const previewImageUrl = ref('')
const previewFileUrl = ref('')
const previewFailed = ref(false)
const searchForm = ref({
  customerName: '',
  phone: '',
  firstSalesUserName: '',
  paymentAccountName: '',
  paymentSerialNo: '',
  tailPaymentSerialNo: '',
  paymentStatus: '',
})
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const imageExtensionPattern = /\.(png|jpe?g|gif|bmp|webp|svg)$/i
const isImageFile = (value?: string) => Boolean(value && imageExtensionPattern.test(value))
const getFileName = (value?: string) => value?.split('/').pop() || '附件文件'
const currentReviewerId = computed(() => authStorage.getUser()?.id || 0)
const selectedPendingOrders = computed(() => orders.value.filter((item) => selectedOrderIds.value.includes(item.id) && item.financeReviewStatus === 'PENDING'))
const orderSummary = computed(() => ({
  totalPaymentAmount: orders.value.reduce((sum, item) => sum + Number(item.paymentAmount || 0), 0),
  totalRawPerformanceAmount: orders.value.reduce((sum, item) => sum + Number(item.rawPerformanceAmount || 0), 0),
  totalHearingCostAmount: orders.value.reduce((sum, item) => sum + Number(item.hearingCostAmount || 0), 0),
  totalPerformanceAmount: orders.value.reduce((sum, item) => sum + Number(item.performanceAmount || 0), 0),
}))

const getFinanceReviewTagType = (status: ThirdSalesOrderListItem['financeReviewStatus']) => {
  if (status === 'APPROVED') {
    return 'success'
  }
  if (status === 'REJECTED') {
    return 'danger'
  }
  return 'warning'
}

const openPreview = (url?: string, title = '附件预览') => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    return
  }
  previewTitle.value = title
  previewFailed.value = false
  if (isImageFile(url)) {
    previewImageUrl.value = absoluteUrl
    previewFileUrl.value = ''
  } else {
    previewImageUrl.value = ''
    previewFileUrl.value = absoluteUrl
  }
  previewVisible.value = true
}

const loadOrders = async () => {
  ordersLoading.value = true
  try {
    const result = await fetchThirdSalesOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
      customerName: searchForm.value.customerName || undefined,
      phone: searchForm.value.phone || undefined,
      firstSalesUserName: searchForm.value.firstSalesUserName || undefined,
      paymentAccountName: searchForm.value.paymentAccountName || undefined,
      paymentSerialNo: searchForm.value.paymentSerialNo || undefined,
      tailPaymentSerialNo: searchForm.value.tailPaymentSerialNo || undefined,
      paymentStatus: searchForm.value.paymentStatus || undefined,
    })
    orders.value = result.items
    total.value = result.total
  } finally {
    ordersLoading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadOrders()
}

const resetSearch = () => {
  searchForm.value.customerName = ''
  searchForm.value.phone = ''
  searchForm.value.firstSalesUserName = ''
  searchForm.value.paymentAccountName = ''
  searchForm.value.paymentSerialNo = ''
  searchForm.value.tailPaymentSerialNo = ''
  searchForm.value.paymentStatus = ''
  currentPage.value = 1
  loadOrders()
}

const openEditDrawer = async (order: ThirdSalesOrderListItem) => {
  orderDrawerVisible.value = true
  await orderDrawerRef.value?.openForEdit(order)
}

const canRecordTailPayment = (order: ThirdSalesOrderListItem) => order.paymentStatus !== '已付清' && order.orderType === '定金'

const openTailPaymentDrawer = async (order: ThirdSalesOrderListItem) => {
  const payload: ThirdSalesOrderPayload = {
    phone: order.phone,
    thirdSalesUserId: order.thirdSalesUserId || 0,
    orderType: 'TAIL',
    productName: order.productName,
    paymentAmount: String(Number(order.arrearsAmount || 0)),
    contractAmount: String(Number(order.arrearsAmount || 0)),
    paymentAccountId: order.paymentAccountId || 0,
    paymentSerialNo: '',
    remark: order.remark,
    paymentScreenshot: null,
    chatRecordFile: null,
    evidenceFiles: [],
  }
  orderDrawerVisible.value = true
  await orderDrawerRef.value?.openForTailPayment(order, payload)
}

const quickCreateRefund = async (order: ThirdSalesOrderListItem) => {
  refundSubmittingId.value = order.id
  refundDraft.value = {
    customerId: order.customerId,
    customerName: order.customerName,
    phone: order.phone,
    sourceStage: 'THIRD_SALES',
    relatedOrderId: order.id,
    relatedOrderStage: 'THIRD',
    firstSalesUserId: order.firstSalesUserId,
    firstSalesUserName: order.firstSalesUserName,
    reason: `客户在三销阶段申请退款，当前业绩订单：${order.productName}`,
    remark: order.remark || '',
    expectedRefundAmount: Number(order.paymentAmount || 0),
  }
  refundDialogVisible.value = true
  refundSubmittingId.value = null
}

const handleDeleteOrder = async (order: ThirdSalesOrderListItem) => {
  await ElMessageBox.confirm(`确认删除三销业绩“${order.customerName}”吗？删除后仅移除当前三销业绩记录。`, '删除三销业绩', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  reviewLoading.value = true
  try {
    await deleteThirdSalesOrder(order.id)
    ElMessage.success('三销业绩已删除')
    await loadOrders()
  } finally {
    reviewLoading.value = false
  }
}

const handleOrderUpdated = async () => {
  await loadOrders()
}

const handleSelectionChange = (rows: ThirdSalesOrderListItem[]) => {
  selectedOrderIds.value = rows.map((item) => item.id)
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
    await batchReviewThirdSalesOrders({
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
    客户姓名: item.customerName,
    手机号码: formatPhone(item.phone, item),
    一销团队: item.firstSalesTeamName || '',
    三销人员: item.thirdSalesUserName,
    服务项目: item.productName,
    付款金额: item.paymentAmount,
    原始业绩: item.rawPerformanceAmount,
    开庭成本: item.hearingCostAmount,
    实际业绩: item.performanceAmount,
    收款账户: item.paymentAccountName || '',
    付款单号: item.paymentSerialNo || '',
    财务审核: item.financeReviewStatusLabel,
    审核人: item.financeReviewerName || '',
    审核时间: formatDateTime(item.financeReviewedAt),
    审核备注: item.financeReviewRemark || '',
    备注: item.remark || '',
    订单时间: formatDateTime(item.orderDate),
    录入时间: formatDateTime(item.createdAt),
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '三销业绩')
  XLSX.writeFile(workbook, '三销业绩订单.xlsx')
}

const paginatedOrders = computed(() => orders.value)

watch(pageSize, () => {
  currentPage.value = 1
  loadOrders()
})

watch(currentPage, () => {
  loadOrders()
})

onMounted(loadOrders)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>三销业绩（开庭）</template>

      <div class="page-stack">

        <el-card shadow="never">
          <template #header>搜索条件</template>
          <el-form inline>
            <el-form-item label="客户姓名">
              <el-input v-model="searchForm.customerName" placeholder="请输入客户姓名" clearable />
            </el-form-item>
            <el-form-item label="手机号码">
              <el-input v-model="searchForm.phone" placeholder="请输入手机号码" clearable />
            </el-form-item>
            <el-form-item label="一销人员">
              <el-input v-model="searchForm.firstSalesUserName" placeholder="请输入一销人员" clearable />
            </el-form-item>
            <el-form-item label="收款账户">
              <el-input v-model="searchForm.paymentAccountName" placeholder="请输入收款账户" clearable />
            </el-form-item>
            <el-form-item label="付款单号">
              <el-input v-model="searchForm.paymentSerialNo" placeholder="请输入付款单号" clearable />
            </el-form-item>
            <el-form-item label="尾款单号">
              <el-input v-model="searchForm.tailPaymentSerialNo" placeholder="请输入尾款单号" clearable />
            </el-form-item>
            <el-form-item label="付款状态">
              <el-select v-model="searchForm.paymentStatus" placeholder="请选择付款状态" clearable>
                <el-option label="部分付款" value="PARTIAL" />
                <el-option label="已付清" value="PAID" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">搜索</el-button>
              <el-button @click="resetSearch">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <div class="stats-grid">
          <el-card shadow="never"><div class="stat-label">回款合计</div><div class="stat-value">{{ formatCurrency(orderSummary.totalPaymentAmount) }}</div></el-card>
          <el-card shadow="never"><div class="stat-label">原始业绩合计</div><div class="stat-value">{{ formatCurrency(orderSummary.totalRawPerformanceAmount) }}</div></el-card>
          <el-card shadow="never"><div class="stat-label">开庭成本合计</div><div class="stat-value">{{ formatCurrency(orderSummary.totalHearingCostAmount) }}</div></el-card>
          <el-card shadow="never"><div class="stat-label">实际业绩合计</div><div class="stat-value success-text">{{ formatCurrency(orderSummary.totalPerformanceAmount) }}</div></el-card>
        </div>

        <el-card shadow="never">
          <template #header>三销业绩订单列表</template>
          <div class="page-stack-sm">
            <el-alert title="这里固定展示已录入过的三销业绩记录，客户后续进入其他阶段后，历史订单仍会保留在列表中。" type="info" :closable="false" show-icon />
            <el-alert title="这里展示回款金额、业绩基数、开庭成本、实际业绩、付款截图和补充证据。" type="info" :closable="false" show-icon />
            <el-space wrap>
              <el-button v-if="canExportThirdSales()" @click="exportOrders">导出Excel</el-button>
              <el-button v-if="canBatchReviewThirdSales()" type="success" :loading="reviewLoading" @click="handleBatchFinanceReview('APPROVE')">批量通过</el-button>
              <el-button v-if="canBatchReviewThirdSales()" type="warning" :loading="reviewLoading" @click="handleBatchFinanceReview('REJECT')">批量驳回</el-button>
            </el-space>
            <el-table ref="orderTableRef" v-loading="ordersLoading" :data="paginatedOrders" @selection-change="handleSelectionChange">
              <el-table-column type="selection" width="55" />
              <el-table-column label="录单时间" min-width="180"><template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template></el-table-column>
              <el-table-column prop="customerName" label="客户姓名" min-width="120" />
              <el-table-column label="手机号码" min-width="140">
                <template #default="scope">{{ formatPhone(scope.row.phone, scope.row) }}</template>
              </el-table-column>
              <el-table-column label="一销团队" min-width="140">
                <template #default="scope">{{ scope.row.firstSalesTeamName || '-' }}</template>
              </el-table-column>
              <el-table-column prop="thirdSalesUserName" label="三销人员" min-width="120" />
              <el-table-column prop="productName" label="服务项目" min-width="160" />
              <el-table-column prop="paymentAmount" label="付款金额" min-width="130">
                <template #default="scope">{{ formatCurrency(scope.row.paymentAmount) }}</template>
              </el-table-column>
              <el-table-column prop="rawPerformanceAmount" label="原始业绩" min-width="130">
                <template #default="scope">{{ formatCurrency(scope.row.rawPerformanceAmount) }}</template>
              </el-table-column>
              <el-table-column prop="hearingCostAmount" label="开庭成本" min-width="130">
                <template #default="scope">{{ formatCurrency(scope.row.hearingCostAmount) }}</template>
              </el-table-column>
              <el-table-column prop="performanceAmount" label="实际业绩" min-width="130">
                <template #default="scope"><span class="success-text">{{ formatCurrency(scope.row.performanceAmount) }}</span></template>
              </el-table-column>
              <el-table-column label="收款账户" min-width="180">
                <template #default="scope">{{ scope.row.paymentAccountName || '-' }}</template>
              </el-table-column>
              <el-table-column label="付款单号" min-width="160">
                <template #default="scope">{{ scope.row.paymentSerialNo || '-' }}</template>
              </el-table-column>
              <el-table-column label="付款截图" min-width="120">
                <template #default="scope">
                  <el-button v-if="scope.row.paymentScreenshotUrl" link type="primary" @click="openPreview(scope.row.paymentScreenshotUrl, '付款截图')">
                    <el-icon><Picture /></el-icon>
                    <span>查看附件</span>
                  </el-button>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="补充证据" min-width="260">
                <template #default="scope">
                  <div v-if="scope.row.evidenceFileUrls.length" class="evidence-grid">
                    <template v-for="(item, index) in scope.row.evidenceFileUrls" :key="`${scope.row.id}-${index}`">
                      <img v-if="isImageFile(item)" :src="toAbsoluteFileUrl(item)" :alt="`证据${index + 1}`" class="attachment-thumbnail" @click="openPreview(item, `证据${index + 1}`)" />
                      <el-button v-else text class="file-chip" @click="openPreview(item, `证据${index + 1}`)">
                        <el-icon><Document /></el-icon>
                        <span>{{ getFileName(item) }}</span>
                      </el-button>
                    </template>
                  </div>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="财务审核" min-width="120">
                <template #default="scope"><el-tag :type="getFinanceReviewTagType(scope.row.financeReviewStatus)">{{ scope.row.financeReviewStatusLabel }}</el-tag></template>
              </el-table-column>
              <el-table-column label="审核人" prop="financeReviewerName" min-width="120" />
              <el-table-column label="审核时间" min-width="180"><template #default="scope">{{ formatDateTime(scope.row.financeReviewedAt) }}</template></el-table-column>
              <el-table-column label="审核备注" prop="financeReviewRemark" min-width="180" show-overflow-tooltip />
              <el-table-column prop="remark" label="备注" min-width="220" show-overflow-tooltip><template #default="scope">{{ scope.row.remark || '-' }}</template></el-table-column>
              <el-table-column prop="customerNo" label="客户编号" min-width="150" />
              <el-table-column label="操作" min-width="280" fixed="right">
                <template #default="scope">
                  <div class="action-cell compact-action-cell">
                    <el-button v-if="canEditThirdSales()" link type="primary" @click="openEditDrawer(scope.row)">编辑</el-button>
                    <el-button v-if="canTailThirdSales() && canRecordTailPayment(scope.row)" link type="warning" @click="openTailPaymentDrawer(scope.row)">补录尾款</el-button>
                    <el-button v-if="canCreateRefund()" link type="danger" :loading="refundSubmittingId === scope.row.id" @click="quickCreateRefund(scope.row)">申请退款</el-button>
                    <el-tooltip v-if="canDeleteThirdSales()" content="删除三销业绩" placement="top">
                      <el-button link type="danger" :icon="Delete" @click="handleDeleteOrder(scope.row)" />
                    </el-tooltip>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="录入时间" min-width="180"><template #default="scope">{{ formatDateTime(scope.row.createdAt) }}</template></el-table-column>
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

    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="handleOrderUpdated" />

    <el-dialog v-model="previewVisible" :title="previewTitle" width="800px">
      <div class="page-stack-sm">
        <img v-if="previewImageUrl && !previewFailed" :src="previewImageUrl" :alt="previewTitle" class="attachment-preview" @error="previewFailed = true" />
        <el-empty v-else-if="previewImageUrl && previewFailed" description="附件加载失败，请检查上传文件是否存在" />
        <iframe v-else-if="previewFileUrl" :src="previewFileUrl" class="attachment-file-frame" />
        <el-empty v-else description="暂无可预览附件" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}

.compact-action-cell :deep(.el-button) {
  padding: 2px 4px;
  font-size: 12px;
}

.success-text {
  color: var(--el-color-success);
  font-weight: 700;
}

.evidence-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-thumbnail {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
}

.attachment-preview {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  margin: 0 auto;
  border-radius: 8px;
}

.attachment-file-frame {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: 8px;
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}
</style>
