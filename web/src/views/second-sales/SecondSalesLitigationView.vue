<script setup lang="ts">
import { Delete, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import * as XLSX from 'xlsx'
import { authStorage } from '../../auth'
import { toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { batchReviewSecondSalesOrders, deleteSecondSalesOrder, fetchSecondSalesOrders } from '../../api/second-sales'
import SecondSalesOrderDrawer from './SecondSalesOrderDrawer.vue'
import type { BatchFinanceReviewPayload, SecondSalesOrderListItem } from '../../types'

const loading = ref(false)
const reviewLoading = ref(false)
const orders = ref<SecondSalesOrderListItem[]>([])
const total = ref(0)
const selectedOrderIds = ref<number[]>([])
const orderDrawerVisible = ref(false)
const orderDrawerRef = ref<InstanceType<typeof SecondSalesOrderDrawer> | null>(null)
const orderTableRef = ref()
const previewVisible = ref(false)
const previewTitle = ref('附件预览')
const previewImageUrl = ref('')
const previewFileUrl = ref('')
const previewFailed = ref(false)
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]

const canBatchReviewSecondSales = () => hasPermission('secondSales.review.batch')
const canEditSecondSales = () => hasPermission('secondSales.edit')
const canExportSecondSales = () => hasPermission('secondSales.export')
const canDeleteSecondSales = () => hasPermission('secondSales.delete')

const formatDateTime = (value?: string) => value?.replace('T', ' ').slice(0, 19) || '-'
const imageExtensionPattern = /\.(png|jpe?g|gif|bmp|webp|svg)$/i
const isImageFile = (value?: string) => Boolean(value && imageExtensionPattern.test(value))
const getFileName = (value?: string) => value?.split('/').pop() || '附件文件'
const currentReviewerId = computed(() => authStorage.getUser()?.id || 0)
const selectedPendingOrders = computed(() => orders.value.filter((item) => selectedOrderIds.value.includes(item.id) && item.financeReviewStatus === 'PENDING'))

const getFinanceReviewTagType = (status: SecondSalesOrderListItem['financeReviewStatus']) => {
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
  loading.value = true
  try {
    const result = await fetchSecondSalesOrders({ page: currentPage.value, pageSize: pageSize.value })
    orders.value = result.items
    total.value = result.total
  } finally {
    loading.value = false
  }
}

const handleSelectionChange = (rows: SecondSalesOrderListItem[]) => {
  selectedOrderIds.value = rows.map((item) => item.id)
}

const openEditDrawer = async (order: SecondSalesOrderListItem) => {
  orderDrawerVisible.value = true
  await orderDrawerRef.value?.openForEdit(order)
}

const handleDeleteOrder = async (order: SecondSalesOrderListItem) => {
  await ElMessageBox.confirm(`确认删除二销业绩“${order.customerName}”吗？删除后仅移除当前二销业绩记录。`, '删除二销业绩', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  reviewLoading.value = true
  try {
    await deleteSecondSalesOrder(order.id)
    ElMessage.success('二销业绩已删除')
    await loadOrders()
  } finally {
    reviewLoading.value = false
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
    await batchReviewSecondSalesOrders({
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
    二销人员: item.secondSalesUserName,
    付款金额: item.secondPaymentAmount,
    包含开庭: item.includesHearing ? '是' : '否',
    开庭成本: item.hearingCostAmount,
    实际业绩: item.performanceAmount,
    收款账户: item.paymentAccountName || '',
    付款单号: item.paymentSerialNo || '',
    财务审核: item.financeReviewStatusLabel,
    审核人: item.financeReviewerName || '',
    审核时间: formatDateTime(item.financeReviewedAt),
    审核备注: item.financeReviewRemark || '',
    录入时间: formatDateTime(item.createdAt),
  }))

  const worksheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '二销业绩')
  XLSX.writeFile(workbook, '二销业绩订单.xlsx')
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
      <template #header>起诉业绩（二销）</template>
      <div class="page-stack-sm">
        <el-alert title="这里固定展示已录入过的二销业绩订单，客户后续转入法务、调解或三销后，历史订单仍会保留在列表中。" type="info" :closable="false" show-icon />
        <el-space wrap>
          <el-button v-if="canExportSecondSales()" @click="exportOrders">导出Excel</el-button>
          <el-button v-if="canBatchReviewSecondSales()" type="success" :loading="reviewLoading" @click="handleBatchFinanceReview('APPROVE')">批量通过</el-button>
          <el-button v-if="canBatchReviewSecondSales()" type="warning" :loading="reviewLoading" @click="handleBatchFinanceReview('REJECT')">批量驳回</el-button>
        </el-space>
        <el-table ref="orderTableRef" v-loading="loading" :data="paginatedOrders" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="55" />
          <el-table-column prop="customerNo" label="客户编号" min-width="150" />
          <el-table-column prop="customerName" label="客户姓名" min-width="120" />
          <el-table-column label="手机号码" min-width="140">
            <template #default="scope">{{ formatPhone(scope.row.phone, scope.row) }}</template>
          </el-table-column>
          <el-table-column label="一销团队" min-width="140">
            <template #default="scope">{{ scope.row.firstSalesTeamName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="secondSalesUserName" label="二销人员" min-width="120" />
          <el-table-column prop="secondPaymentAmount" label="付款金额" min-width="120" />
          <el-table-column label="包含开庭" min-width="100">
            <template #default="scope">{{ scope.row.includesHearing ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column label="开庭成本" min-width="120">
            <template #default="scope">{{ scope.row.hearingCostAmount }}</template>
          </el-table-column>
          <el-table-column label="实际业绩" min-width="120">
            <template #default="scope">{{ scope.row.performanceAmount }}</template>
          </el-table-column>
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
          <el-table-column label="付款截图" min-width="160">
            <template #default="scope">
              <div v-if="scope.row.paymentScreenshotUrl" class="thumbnail-cell">
                <img
                  :src="toAbsoluteFileUrl(scope.row.paymentScreenshotUrl)"
                  alt="付款截图"
                  class="attachment-thumbnail"
                  @click="openPreview(scope.row.paymentScreenshotUrl, '付款截图')"
                />
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="聊天记录截图" min-width="180">
            <template #default="scope">
              <div v-if="scope.row.chatRecordUrl" class="thumbnail-cell">
                <img
                  :src="toAbsoluteFileUrl(scope.row.chatRecordUrl)"
                  alt="聊天记录截图"
                  class="attachment-thumbnail"
                  @click="openPreview(scope.row.chatRecordUrl, '聊天记录截图')"
                />
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="证据文件" min-width="260">
            <template #default="scope">
              <div v-if="scope.row.evidenceFileUrls.length" class="evidence-grid">
                <template v-for="(item, index) in scope.row.evidenceFileUrls" :key="`${scope.row.id}-${index}`">
                  <img
                    v-if="isImageFile(item)"
                    :src="toAbsoluteFileUrl(item)"
                    :alt="`证据${index + 1}`"
                    class="attachment-thumbnail"
                    @click="openPreview(item, `证据${index + 1}`)"
                  />
                  <el-button v-else text class="file-chip" @click="openPreview(item, `证据${index + 1}`)">
                    <el-icon><Document /></el-icon>
                    <span>{{ getFileName(item) }}</span>
                  </el-button>
                </template>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="160" fixed="right">
            <template #default="scope">
              <el-button v-if="canEditSecondSales()" link type="primary" @click="openEditDrawer(scope.row)">编辑</el-button>
              <el-tooltip v-if="canDeleteSecondSales()" content="删除二销业绩" placement="top">
                <el-button link type="danger" :icon="Delete" @click="handleDeleteOrder(scope.row)" />
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="录入时间" min-width="180">
            <template #default="scope">
              {{ formatDateTime(scope.row.createdAt) }}
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

    <el-dialog v-model="previewVisible" :title="previewTitle" width="800px">
      <div class="page-stack-sm">
        <img
          v-if="previewImageUrl && !previewFailed"
          :src="previewImageUrl"
          :alt="previewTitle"
          class="attachment-preview"
          @error="previewFailed = true"
        />
        <el-empty v-else-if="previewImageUrl && previewFailed" description="截图加载失败，请检查上传文件是否存在" />
        <iframe v-else-if="previewFileUrl" :src="previewFileUrl" class="attachment-file-frame" />
        <el-empty v-else description="暂无可预览附件" />
      </div>
    </el-dialog>
    <SecondSalesOrderDrawer ref="orderDrawerRef" v-model:visible="orderDrawerVisible" @updated="loadOrders" />
  </div>
</template>

<style scoped>
.thumbnail-cell {
  display: flex;
  align-items: center;
}

.evidence-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
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
