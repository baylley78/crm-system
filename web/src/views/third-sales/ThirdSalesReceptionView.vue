<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { fetchThirdSalesReceptions } from '../../api/third-sales'
import type { ThirdSalesReceptionItem } from '../../types'
import RefundCreateDialog from '../refund/RefundCreateDialog.vue'
import ThirdSalesOrderDrawer from './ThirdSalesOrderDrawer.vue'

const canCreateThirdSales = () => hasPermission('thirdSales.create')
const canViewThirdSalesReceptions = () => hasPermission('thirdSales.reception.view')
const canCreateRefund = () => hasPermission('refund.create')

const loading = ref(false)
const receptions = ref<ThirdSalesReceptionItem[]>([])
const total = ref(0)
const refundingId = ref<number | null>(null)
const refundDialogVisible = ref(false)
const refundDraft = ref<any>(null)
const activeTab = ref('pending')
const orderDrawerVisible = ref(false)
const orderDrawerRef = ref<InstanceType<typeof ThirdSalesOrderDrawer> | null>(null)
const currentPage = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]

const isPendingStatus = (status: string) => status === '待转三销' || status === 'PENDING_THIRD_SALES'
const isFollowingStatus = (status: string) => status === '三销开发中' || status === 'THIRD_SALES_FOLLOWING' || status === '已完成三销' || status === 'COMPLETED_THIRD_SALES'
const canSubmitThirdSales = (status: string) =>
  status === '待转三销' ||
  status === 'PENDING_THIRD_SALES' ||
  status === '三销开发中' ||
  status === 'THIRD_SALES_FOLLOWING'

const sourceStageLabel = (value?: ThirdSalesReceptionItem['thirdSalesSourceStage']) => {
  if (value === 'SECOND_SALES') {
    return '来自二销'
  }
  if (value === 'LEGAL') {
    return '来自法务'
  }
  return '-'
}

const canOpenQuickCreate = computed(() => activeCustomers.value.some((item) => canSubmitThirdSales(item.currentStatus)))

const formatCurrency = (value?: number) => `¥${Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const loadData = async () => {
  if (!canViewThirdSalesReceptions()) {
    receptions.value = []
    return
  }

  loading.value = true
  try {
    const result = await fetchThirdSalesReceptions({ page: currentPage.value, pageSize: pageSize.value })
    receptions.value = result.items
    total.value = result.total
    const hasPending = receptions.value.some((item) => isPendingStatus(item.currentStatus))
    const hasFollowing = receptions.value.some((item) => isFollowingStatus(item.currentStatus))
    if (hasPending) {
      activeTab.value = 'pending'
    } else if (hasFollowing) {
      activeTab.value = 'following'
    }
  } finally {
    loading.value = false
  }
}

const openOrderDrawer = async (item: ThirdSalesReceptionItem) => {
  orderDrawerVisible.value = true
  await orderDrawerRef.value?.openForCustomer(item)
}

const quickCreateRefund = async (item: ThirdSalesReceptionItem) => {
  refundingId.value = item.id
  refundDraft.value = {
    customerId: item.id,
    customerName: item.name,
    phone: item.phone,
    sourceStage: 'THIRD_SALES',
    reason: `客户在三销接待阶段申请退款，当前状态：${item.currentStatus}`,
  }
  refundDialogVisible.value = true
  refundingId.value = null
}

const pendingCustomers = computed(() => receptions.value.filter((item) => isPendingStatus(item.currentStatus)))
const followingCustomers = computed(() => receptions.value.filter((item) => isFollowingStatus(item.currentStatus)))
const activeCustomers = computed(() => (activeTab.value === 'pending' ? pendingCustomers.value : followingCustomers.value))
const paginatedCustomers = computed(() => activeCustomers.value)

watch(activeTab, () => {
  currentPage.value = 1
  loadData()
})

watch(pageSize, () => {
  currentPage.value = 1
  loadData()
})

watch(currentPage, () => {
  loadData()
})

onMounted(loadData)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>
        <div class="card-header-row">
          <span>三销接待</span>
          <el-button v-if="canCreateThirdSales()" type="primary" :disabled="!canOpenQuickCreate" @click="openOrderDrawer(activeCustomers.find((item) => canSubmitThirdSales(item.currentStatus))!)">录入三销业绩</el-button>
        </div>
      </template>

      <div class="page-stack">
        <el-alert title="二销直转或法务立案成功的客户都会进入这里，三销可直接打开抽屉录入业绩。" type="info" :closable="false" show-icon />

        <el-tabs v-model="activeTab">
          <el-tab-pane :label="`待接待 (${pendingCustomers.length})`" name="pending" />
          <el-tab-pane :label="`跟进中/已完成 (${followingCustomers.length})`" name="following" />
        </el-tabs>

        <el-table v-loading="loading" :data="paginatedCustomers">
          <el-table-column label="客户编号" prop="customerNo" min-width="150" />
          <el-table-column label="客户姓名" prop="name" min-width="120" />
          <el-table-column label="手机号码" min-width="130">
            <template #default="scope">
              {{ formatPhone(scope.row.phone, scope.row) }}
            </template>
          </el-table-column>
          <el-table-column label="当前状态" prop="currentStatus" min-width="140" />
          <el-table-column label="来源" min-width="100">
            <template #default="scope">
              {{ sourceStageLabel(scope.row.thirdSalesSourceStage) }}
            </template>
          </el-table-column>
          <el-table-column label="案件类型" prop="caseType" min-width="140" />
          <el-table-column label="一销人员" prop="firstSalesUserName" min-width="120" />
          <el-table-column label="二销人员" prop="secondSalesUserName" min-width="120" />
          <el-table-column label="三销人员" prop="thirdSalesUserName" min-width="120" />
          <el-table-column label="累计回款" min-width="130">
            <template #default="scope">{{ formatCurrency(scope.row.totalPaymentAmount) }}</template>
          </el-table-column>
          <el-table-column label="欠款金额" min-width="130">
            <template #default="scope">{{ formatCurrency(scope.row.arrearsAmount) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="scope">
              <el-button v-if="canCreateThirdSales()" link type="success" :disabled="!canSubmitThirdSales(scope.row.currentStatus)" @click="openOrderDrawer(scope.row)">录入三销业绩</el-button>
              <el-button v-if="canCreateRefund()" link type="danger" :loading="refundingId === scope.row.id" @click="quickCreateRefund(scope.row)">申请退款</el-button>
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

    <ThirdSalesOrderDrawer ref="orderDrawerRef" v-model:visible="orderDrawerVisible" @updated="loadData" />
    <RefundCreateDialog v-model:visible="refundDialogVisible" :draft="refundDraft" @success="loadData" />
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
