<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { hasPermission, formatPhone } from '../../utils/permissions'
import AttachmentPreviewDialog from '../../components/AttachmentPreviewDialog.vue'
import { getFileName, toAbsoluteFileUrl, useAttachmentPreview } from '../../composables/useAttachmentPreview'
import { createContractArchive, fetchContractArchives, fetchContractCustomers, fetchContractUsers, fetchCustomerContractOrders } from '../../api/contracts'
import type { ContractArchiveItem, ContractArchivePayload, ContractCustomerOption, ContractRelatedOrderOption, SalesUserOption } from '../../types'

const canCreateContract = () => hasPermission('contracts.create')
const canViewContractCustomers = () => hasPermission('contracts.customers.view')
const canViewContractUsers = () => hasPermission('contracts.users.view')
const canViewContractOrders = () => hasPermission('contracts.orders.view')
const canOpenCreateContract = () => canCreateContract() && canViewContractCustomers() && canViewContractUsers() && canViewContractOrders()

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const contracts = ref<ContractArchiveItem[]>([])
const customers = ref<ContractCustomerOption[]>([])
const specialists = ref<SalesUserOption[]>([])
const relatedOrders = ref<ContractRelatedOrderOption[]>([])
const contractFileList = ref<Array<{ name: string }>>([])
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]
const contractPreview = useAttachmentPreview('合同预览')

const form = reactive<ContractArchivePayload>({
  contractNo: '',
  customerId: 0,
  salesStage: 'FIRST',
  relatedOrderId: 0,
  amount: 0,
  signDate: '',
  contractSpecialistId: 0,
  remark: '',
  contractFile: null,
})

const stageLabelMap: Record<'FIRST' | 'SECOND' | 'THIRD', string> = {
  FIRST: '一销',
  SECOND: '二销',
  THIRD: '三销',
}

const filteredOrders = computed(() => relatedOrders.value.filter((item) => item.salesStage === form.salesStage))
const formatDate = (value?: string) => value?.slice(0, 10) || '-'

const loadData = async () => {
  loading.value = true
  try {
    const requests: Array<Promise<unknown>> = [fetchContractArchives()]
    if (canViewContractCustomers()) {
      requests.push(fetchContractCustomers())
    }
    if (canViewContractUsers()) {
      requests.push(fetchContractUsers())
    }

    const [contractList, customerList, userList] = await Promise.all(requests)
    contracts.value = contractList as ContractArchiveItem[]
    customers.value = (customerList as ContractCustomerOption[] | undefined) || []
    specialists.value = (userList as SalesUserOption[] | undefined) || []
    if (!form.contractSpecialistId && specialists.value[0]) {
      form.contractSpecialistId = specialists.value[0].id
    }
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.contractNo = ''
  form.customerId = 0
  form.salesStage = 'FIRST'
  form.relatedOrderId = 0
  form.amount = 0
  form.signDate = ''
  form.contractSpecialistId = specialists.value[0]?.id || 0
  form.remark = ''
  form.contractFile = null
  relatedOrders.value = []
  contractFileList.value = []
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  resetForm()
}

const handleContractFileChange = (file: { raw?: File }) => {
  form.contractFile = file.raw || null
  contractFileList.value = file.raw ? [{ name: file.raw.name }] : []
}

const handleContractFileRemove = () => {
  form.contractFile = null
  contractFileList.value = []
}

const submit = async () => {
  if (!form.contractNo.trim()) {
    ElMessage.warning('请输入合同编号')
    return
  }
  if (!form.customerId) {
    ElMessage.warning('请选择关联客户')
    return
  }
  if (!form.relatedOrderId) {
    ElMessage.warning('请选择关联销售记录')
    return
  }
  if (!form.signDate) {
    ElMessage.warning('请选择签约日期')
    return
  }
  if (Number(form.amount) < 0) {
    ElMessage.warning('合同金额不能小于 0')
    return
  }
  if (!form.contractSpecialistId) {
    ElMessage.warning('请选择合同专员')
    return
  }

  saving.value = true
  try {
    await createContractArchive(form)
    ElMessage.success('合同档案已创建')
    closeDialog()
    await loadData()
  } finally {
    saving.value = false
  }
}

watch(
  () => form.customerId,
  async (customerId) => {
    form.relatedOrderId = 0
    if (!customerId || !canViewContractOrders()) {
      relatedOrders.value = []
      return
    }
    relatedOrders.value = await fetchCustomerContractOrders(customerId)
    const firstMatch = relatedOrders.value.find((item) => item.salesStage === form.salesStage)
    if (firstMatch) {
      form.relatedOrderId = firstMatch.id
    }
  },
)

watch(
  () => form.salesStage,
  (stage) => {
    const firstMatch = relatedOrders.value.find((item) => item.salesStage === stage)
    form.relatedOrderId = firstMatch?.id || 0
  },
)

const paginatedContracts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return contracts.value.slice(start, start + pageSize.value)
})

watch(contracts, (value) => {
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
        <div class="page-header-row">
          <span>合同档案</span>
          <el-button v-if="canOpenCreateContract()" type="primary" @click="openCreateDialog">新增合同</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="paginatedContracts">
        <el-table-column prop="contractNo" label="合同编号" min-width="180" />
        <el-table-column prop="customerName" label="客户姓名" min-width="120" />
        <el-table-column label="手机号" min-width="140">
          <template #default="scope">
            {{ formatPhone(scope.row.customerPhone, scope.row) }}
          </template>
        </el-table-column>
        <el-table-column label="关联销售" min-width="120">
          <template #default="scope">
            {{ stageLabelMap[scope.row.salesStage as 'FIRST' | 'SECOND' | 'THIRD'] }} / #{{ scope.row.relatedOrderId }}
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="合同金额" min-width="120" />
        <el-table-column label="签约日期" min-width="120">
          <template #default="scope">
            {{ formatDate(scope.row.signDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="contractSpecialistName" label="合同专员" min-width="120" />
        <el-table-column label="合同文件" min-width="180">
          <template #default="scope">
            <div v-if="scope.row.fileUrl" class="contract-action-cell">
              <el-button text type="primary" @click="contractPreview.openPreview(scope.row.fileUrl, scope.row.contractNo)">预览</el-button>
              <el-link :href="toAbsoluteFileUrl(scope.row.fileUrl)" :download="getFileName(scope.row.fileUrl, scope.row.contractNo)" type="primary">
                <el-icon><Download /></el-icon>
              </el-link>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="创建时间" min-width="180">
          <template #default="scope">
            {{ scope.row.createdAt?.replace('T', ' ').slice(0, 19) || '-' }}
          </template>
        </el-table-column>
      </el-table>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="pageSizeOptions"
          :total="contracts.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" title="新增合同" width="720px">
      <el-form label-width="110px" class="form-grid">
        <el-form-item label="合同编号">
          <el-input v-model="form.contractNo" placeholder="请输入合同编号" />
        </el-form-item>
        <el-form-item label="关联客户">
          <el-select v-model="form.customerId" placeholder="请选择客户" filterable>
            <el-option v-for="item in customers" :key="item.id" :label="`${item.name} / ${formatPhone(item.phone, item)}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="销售阶段">
          <el-select v-model="form.salesStage" placeholder="请选择销售阶段">
            <el-option label="一销" value="FIRST" />
            <el-option label="二销" value="SECOND" />
            <el-option label="三销" value="THIRD" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联销售记录">
          <el-select v-model="form.relatedOrderId" placeholder="请选择关联销售记录" :disabled="!form.customerId">
            <el-option v-for="item in filteredOrders" :key="`${item.salesStage}-${item.id}`" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="签约日期">
          <el-date-picker v-model="form.signDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择签约日期" />
        </el-form-item>
        <el-form-item label="合同金额">
          <el-input v-model.number="form.amount" type="number" placeholder="请输入合同金额" />
        </el-form-item>
        <el-form-item label="合同专员">
          <el-select v-model="form.contractSpecialistId" placeholder="请选择合同专员" filterable>
            <el-option v-for="item in specialists" :key="item.id" :label="item.realName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="合同文件">
          <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :file-list="contractFileList" :on-change="handleContractFileChange" :on-remove="handleContractFileRemove">
            <el-button>上传合同文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>

    <AttachmentPreviewDialog
      v-model:visible="contractPreview.visible.value"
      :title="contractPreview.title.value"
      :image-url="contractPreview.imageUrl.value"
      :file-url="contractPreview.fileUrl.value"
      :download-url="contractPreview.downloadUrl.value"
      :show-download="true"
      :download-name="getFileName(contractPreview.downloadUrl.value, contractPreview.title.value)"
      @update:visible="(value) => !value && contractPreview.closePreview()"
    />
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.page-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.contract-action-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
