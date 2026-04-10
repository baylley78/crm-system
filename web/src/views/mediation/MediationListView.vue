<script setup lang="ts">
import { Delete, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref, watch, computed } from 'vue'
import { getFileName, isImageFile, toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { completeMediationCase, fetchMediationCases, fetchMediationUsers, followMediationCase } from '../../api/mediation'
import { deleteCustomer } from '../../api/customers'
import type { MediationCaseItem, SalesUserOption, SaveMediationCasePayload } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'

const canEditMediation = () => hasPermission('mediation.edit')
const canEditMediationTime = () => hasPermission('mediation.time.edit')
const canCompleteMediation = () => hasPermission('mediation.complete')
const canCreateRefund = () => hasPermission('refund.create')
const canDeleteCustomers = () => hasPermission('customers.delete')

type MediationActionType = 'FOLLOW' | 'COMPLETE'

const loading = ref(false)
const saving = ref(false)
const cases = ref<MediationCaseItem[]>([])
const total = ref(0)
const users = ref<SalesUserOption[]>([])
const refundingId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const activeCase = ref<MediationCaseItem | null>(null)
const actionDialogVisible = ref(false)
const actionType = ref<MediationActionType>('FOLLOW')
const editingCase = ref<MediationCaseItem | null>(null)
const activeTab = ref<'pending' | 'processing' | 'completed'>('pending')
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]
const form = reactive<SaveMediationCasePayload>({
  customerId: 0,
  progressStatus: '',
  mediationResult: '',
  remark: '',
  evidenceFiles: [],
  startDate: '',
  isCompleted: false,
})

const syncActiveCase = (caseList: MediationCaseItem[]) => {
  if (!activeCase.value && caseList[0]) {
    selectCase(caseList[0])
    return
  }

  if (activeCase.value) {
    const nextActive = caseList.find((item) => item.customerId === activeCase.value?.customerId)
    if (nextActive) {
      selectCase(nextActive)
      return
    }
  }

  activeCase.value = caseList[0] || null
}

const canPreviewAttachment = (url?: string) => Boolean(toAbsoluteFileUrl(url))

const openAttachment = (url?: string) => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    ElMessage.warning('附件地址无效')
    return
  }
  window.open(absoluteUrl, '_blank', 'noopener')
}

const loadData = async () => {
  loading.value = true
  try {
    const [caseResult, userList] = await Promise.all([
      fetchMediationCases({ page: currentPage.value, pageSize: pageSize.value }),
      fetchMediationUsers(),
    ])
    cases.value = caseResult.items
    total.value = caseResult.total
    users.value = userList

    if (activeTab.value === 'pending' && !pendingCases.value.length) {
      activeTab.value = processingCases.value.length ? 'processing' : completedCases.value.length ? 'completed' : 'pending'
    } else if (activeTab.value === 'processing' && !processingCases.value.length) {
      activeTab.value = pendingCases.value.length ? 'pending' : completedCases.value.length ? 'completed' : 'processing'
    } else if (activeTab.value === 'completed' && !completedCases.value.length) {
      activeTab.value = pendingCases.value.length ? 'pending' : processingCases.value.length ? 'processing' : 'completed'
    }

    syncActiveCase(activeCases.value)
  } finally {
    loading.value = false
  }
}

const canPendingStatus = (status: string) => status === '待转调解' || status === 'PENDING_MEDIATION'
const canProcessingStatus = (status: string) => status === '调解处理中' || status === 'MEDIATION_PROCESSING'
const canCompletedStatus = (status: string) => status === '调解完成' || status === 'MEDIATION_COMPLETED'

const formatStatus = (status: string) => {
  if (canPendingStatus(status)) {
    return '待转调解'
  }
  if (canProcessingStatus(status)) {
    return '调解处理中'
  }
  if (canCompletedStatus(status)) {
    return '调解完成'
  }
  return status
}

const pendingCases = computed(() => cases.value.filter((item) => canPendingStatus(item.currentStatus)))
const processingCases = computed(() => cases.value.filter((item) => canProcessingStatus(item.currentStatus)))
const completedCases = computed(() => cases.value.filter((item) => canCompletedStatus(item.currentStatus)))
const sortedPendingCases = computed(() => [...pendingCases.value].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))
const activeCases = computed(() => {
  if (activeTab.value === 'pending') {
    return sortedPendingCases.value
  }
  if (activeTab.value === 'processing') {
    return processingCases.value
  }
  return completedCases.value
})

const resetForm = () => {
  form.customerId = 0
  form.progressStatus = '调解处理中'
  form.mediationResult = ''
  form.remark = ''
  form.evidenceFiles = []
  form.startDate = ''
  form.isCompleted = false
  form.ownerId = undefined
}

const fillForm = (item: MediationCaseItem, type: MediationActionType) => {
  form.customerId = item.customerId
  form.progressStatus = item.progressStatus || (canPendingStatus(item.currentStatus) ? '待接手' : '调解处理中')
  form.mediationResult = item.mediationResult || ''
  form.remark = item.remark || ''
  form.evidenceFiles = []
  form.startDate = item.startDate ? item.startDate.slice(0, 16) : ''
  form.isCompleted = type === 'COMPLETE'
  form.ownerId = item.ownerId
}

const selectCase = (item: MediationCaseItem | null) => {
  activeCase.value = item
}

const rowClassName = ({ row }: { row: MediationCaseItem }) => {
  return canPendingStatus(row.currentStatus) ? 'row-pending-mediation' : ''
}

const openActionDialog = (item: MediationCaseItem, type: MediationActionType) => {
  selectCase(item)
  editingCase.value = item
  actionType.value = type
  fillForm(item, type)
  actionDialogVisible.value = true
}

const quickCreateRefund = async (item: MediationCaseItem) => {
  refundingId.value = item.customerId
  refundDraft.value = {
    customerId: item.customerId,
    customerName: item.name,
    phone: item.phone,
    sourceStage: 'MEDIATION',
    firstSalesUserId: item.firstSalesUserId,
    firstSalesUserName: item.firstSalesUserName,
    reason: `客户在调解阶段申请退款，当前进度：${item.progressStatus}`,
    remark: item.remark || '',
  }
  refundDialogVisible.value = true
  refundingId.value = null
}

const handleDeleteCustomer = async (item: MediationCaseItem) => {
  await ElMessageBox.confirm(`确认删除客户“${item.name}”吗？删除后该客户的相关业绩与跟进数据也会一并删除。`, '删除客户', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
  })

  saving.value = true
  try {
    await deleteCustomer(item.customerId)
    ElMessage.success('客户已删除')
    await loadData()
  } finally {
    saving.value = false
  }
}

const handleEvidenceChange = (_uploadFile: any, uploadFiles: any[]) => {
  form.evidenceFiles = uploadFiles.map((item) => item.raw).filter(Boolean)
}

const handleDialogClosed = () => {
  actionDialogVisible.value = false
  editingCase.value = null
  resetForm()
}

const submit = async () => {
  if (!form.customerId) {
    ElMessage.warning('请先选择调解案件')
    return
  }

  saving.value = true
  try {
    if (actionType.value === 'COMPLETE') {
      await completeMediationCase(form)
      ElMessage.success('调解已完结')
    } else {
      await followMediationCase(form)
      ElMessage.success(canPendingStatus(editingCase.value?.currentStatus || '') ? '已接手并进入调解处理中' : '调解跟进已提交')
    }
    actionDialogVisible.value = false
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

watch(activeTab, () => {
  syncActiveCase(activeCases.value)
})

onMounted(async () => {
  resetForm()
  await loadData()
})
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>调解分配（二销接待）</template>

      <div class="page-stack mediation-page">
        <el-alert title="二销失败客户会先进入待转调解，调解接手后进入调解处理中。" type="info" :closable="false" show-icon />
        <el-card shadow="never">
          <template #header>
            <div class="card-header-row">
              <span>调解案件列表</span>
            </div>
          </template>
          <el-tabs v-model="activeTab">
            <el-tab-pane :label="`待转调解 (${pendingCases.length})`" name="pending" />
            <el-tab-pane :label="`调解处理中 (${processingCases.length})`" name="processing" />
            <el-tab-pane :label="`调解完成 (${completedCases.length})`" name="completed" />
          </el-tabs>
          <el-table v-loading="loading" :data="activeCases" :row-class-name="rowClassName" highlight-current-row @current-change="selectCase" @row-click="selectCase">
            <el-table-column label="客户编号" prop="customerNo" min-width="150" />
            <el-table-column label="客户姓名" prop="name" min-width="120" />
            <el-table-column label="手机号码" min-width="130">
              <template #default="scope">
                {{ formatPhone(scope.row.phone, scope.row) }}
              </template>
            </el-table-column>
            <el-table-column label="案件类型" prop="caseType" min-width="120" />
            <el-table-column label="当前状态" prop="currentStatus" min-width="140">
              <template #default="scope">
                {{ formatStatus(scope.row.currentStatus) }}
              </template>
            </el-table-column>
            <el-table-column label="调解负责人" prop="ownerName" min-width="120" />
            <el-table-column label="调解进度" prop="progressStatus" min-width="140" />
            <el-table-column label="提醒" min-width="100">
              <template #default="scope">
                <el-tag v-if="canPendingStatus(scope.row.currentStatus)" type="warning">待接手</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="220" fixed="right">
              <template #default="scope">
                <div class="action-cell compact-action-cell">
                  <el-button v-if="canEditMediation()" type="primary" link @click.stop="openActionDialog(scope.row, 'FOLLOW')">跟进</el-button>
                  <el-button v-if="canCompleteMediation()" type="success" link :disabled="scope.row.isCompleted" @click.stop="openActionDialog(scope.row, 'COMPLETE')">完结</el-button>
                  <el-button v-if="canCreateRefund()" type="danger" link :loading="refundingId === scope.row.customerId" @click.stop="quickCreateRefund(scope.row)">申请退款</el-button>
                  <el-tooltip v-if="canDeleteCustomers()" content="删除客户" placement="top">
                    <el-button link type="danger" :icon="Delete" @click.stop="handleDeleteCustomer(scope.row)" />
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
        </el-card>

        <el-card shadow="never">
          <template #header>客户接待信息</template>
          <div class="page-stack-sm">
            <el-descriptions :column="4" border>
              <el-descriptions-item label="客户编号">{{ activeCase?.customerNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="客户姓名">{{ activeCase?.name || '请选择案件' }}</el-descriptions-item>
              <el-descriptions-item label="手机号码">{{ formatPhone(activeCase?.phone, activeCase || undefined) }}</el-descriptions-item>
              <el-descriptions-item label="当前状态">{{ activeCase ? formatStatus(activeCase.currentStatus) : '-' }}</el-descriptions-item>
              <el-descriptions-item label="一销人员">{{ activeCase?.firstSalesUserName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="二销人员">{{ activeCase?.secondSalesUserName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="客户来源">{{ activeCase?.source || '-' }}</el-descriptions-item>
              <el-descriptions-item label="意向等级">{{ activeCase?.intentionLevel || '-' }}</el-descriptions-item>
              <el-descriptions-item label="案件类型">{{ activeCase?.caseType || '-' }}</el-descriptions-item>
              <el-descriptions-item label="一销付款">{{ activeCase?.firstPaymentAmount || 0 }}</el-descriptions-item>
              <el-descriptions-item label="二销付款">{{ activeCase?.secondPaymentAmount || 0 }}</el-descriptions-item>
              <el-descriptions-item label="欠款金额">{{ activeCase?.arrearsAmount || 0 }}</el-descriptions-item>
            </el-descriptions>

            <el-card shadow="never">
              <template #header>一销销售信息</template>
              <template v-if="activeCase">
                <div class="page-stack-sm">
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="客户备注">{{ activeCase.customerRemark || '-' }}</el-descriptions-item>
                    <el-descriptions-item label="一销备注">{{ activeCase.firstSalesRemark || '-' }}</el-descriptions-item>
                  </el-descriptions>

                  <div class="attachment-section">
                    <div class="attachment-section-title">付款截图</div>
                    <div v-if="canPreviewAttachment(activeCase.firstSalesPaymentScreenshotUrl)" class="attachment-grid">
                      <img
                        :src="toAbsoluteFileUrl(activeCase.firstSalesPaymentScreenshotUrl)"
                        alt="一销付款截图"
                        class="attachment-thumbnail"
                        @click="openAttachment(activeCase.firstSalesPaymentScreenshotUrl)"
                      />
                    </div>
                    <el-empty v-else description="暂无付款截图" />
                  </div>

                  <div class="attachment-section">
                    <div class="attachment-section-title">聊天记录</div>
                    <div v-if="canPreviewAttachment(activeCase.firstSalesChatRecordUrl)" class="attachment-grid">
                      <img
                        v-if="isImageFile(activeCase.firstSalesChatRecordUrl)"
                        :src="toAbsoluteFileUrl(activeCase.firstSalesChatRecordUrl)"
                        alt="一销聊天记录"
                        class="attachment-thumbnail"
                        @click="openAttachment(activeCase.firstSalesChatRecordUrl)"
                      />
                      <el-button v-else text class="file-chip" @click="openAttachment(activeCase.firstSalesChatRecordUrl)">
                        <el-icon><Document /></el-icon>
                        <span>{{ getFileName(activeCase.firstSalesChatRecordUrl) }}</span>
                      </el-button>
                    </div>
                    <el-empty v-else description="暂无聊天记录" />
                  </div>

                  <div class="attachment-section">
                    <div class="attachment-section-title">证据材料</div>
                    <div v-if="activeCase.firstSalesEvidenceFileUrls.length" class="attachment-grid">
                      <template v-for="(item, index) in activeCase.firstSalesEvidenceFileUrls" :key="item + '-' + index">
                        <img
                          v-if="isImageFile(item)"
                          :src="toAbsoluteFileUrl(item)"
                          :alt="`一销证据${index + 1}`"
                          class="attachment-thumbnail"
                          @click="openAttachment(item)"
                        />
                        <el-button v-else text class="file-chip" @click="openAttachment(item)">
                          <el-icon><Document /></el-icon>
                          <span>{{ getFileName(item) }}</span>
                        </el-button>
                      </template>
                    </div>
                    <el-empty v-else description="暂无证据材料" />
                  </div>
                </div>
              </template>
              <el-empty v-else description="请选择案件" />
            </el-card>
          </div>
        </el-card>
      </div>
    </el-card>

    <el-dialog
      v-model="actionDialogVisible"
      :title="actionType === 'COMPLETE' ? '完结调解' : '调解跟进'"
      width="720px"
      @closed="handleDialogClosed"
    >
      <el-form label-width="120px" class="page-stack">
        <div class="form-grid">
          <el-form-item label="客户姓名">
            <div class="static-text">{{ editingCase?.name || '-' }}</div>
          </el-form-item>
          <el-form-item label="当前状态">
            <div class="static-text">{{ editingCase ? formatStatus(editingCase.currentStatus) : '-' }}</div>
          </el-form-item>
          <el-form-item label="调解负责人">
            <el-select v-model="form.ownerId" clearable filterable placeholder="请选择调解专员" style="width: 100%">
              <el-option v-for="user in users" :key="user.id" :label="`${user.realName}（${user.roleName}）`" :value="user.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="调解进度">
            <el-input v-model="form.progressStatus" placeholder="请输入调解进度" />
          </el-form-item>
          <el-form-item label="调解结果">
            <el-input v-model="form.mediationResult" placeholder="请输入调解结果" />
          </el-form-item>
          <el-form-item v-if="canEditMediationTime()" label="开始时间">
            <el-date-picker v-model="form.startDate" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="请选择调解开始时间" style="width: 100%" />
          </el-form-item>
        </div>

        <el-form-item label="处理备注" class="full-width">
          <el-input v-model="form.remark" type="textarea" :rows="4" placeholder="请输入调解接待说明、跟进记录或处理备注" />
        </el-form-item>

        <el-form-item label="补充证据" class="full-width">
          <el-upload drag multiple :auto-upload="false" :show-file-list="true" :on-change="handleEvidenceChange">
            <div>拖拽文件到此处，或点击上传调解证据</div>
          </el-upload>
          <div v-if="editingCase?.evidenceFileUrls?.length" class="evidence-links">
            <el-link v-for="url in editingCase.evidenceFileUrls" :key="url" :href="url" target="_blank" type="primary">查看已有证据</el-link>
          </div>
        </el-form-item>

        <el-form-item class="full-width dialog-actions">
          <el-button @click="actionDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="submit">{{ actionType === 'COMPLETE' ? '确认完结' : '提交跟进' }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadData" />
  </div>
</template>

<style scoped>
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

.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.mediation-page {
  gap: 16px;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

:deep(.row-pending-mediation) {
  --el-table-tr-bg-color: #fff7e6;
}

:deep(.row-pending-mediation:hover > td.el-table__cell) {
  background-color: #ffefcc !important;
}

.attachment-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-section-title {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.attachment-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.attachment-thumbnail {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
}

.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.full-width {
  width: 100%;
}

.evidence-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.static-text {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}

.dialog-actions :deep(.el-form-item__content) {
  justify-content: flex-end;
}
</style>
