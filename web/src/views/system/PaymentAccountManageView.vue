<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPaymentAccount, fetchPaymentAccounts, updatePaymentAccount } from '../../api/payment-accounts'
import type { PaymentAccountItem, PaymentAccountPayload } from '../../types'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const keyword = ref('')
const statusFilter = ref('')
const accounts = ref<PaymentAccountItem[]>([])
const form = reactive<PaymentAccountPayload>({
  accountName: '',
  bankName: '',
  accountNo: '',
  remark: '',
  isActive: true,
})

const loadAccounts = async () => {
  loading.value = true
  try {
    accounts.value = await fetchPaymentAccounts()
  } finally {
    loading.value = false
  }
}

const filteredAccounts = computed(() => {
  const keywordValue = keyword.value.trim().toLowerCase()

  return accounts.value.filter((item) => {
    const matchesKeyword =
      !keywordValue ||
      item.accountName.toLowerCase().includes(keywordValue) ||
      item.accountNo.toLowerCase().includes(keywordValue) ||
      item.bankName?.toLowerCase().includes(keywordValue) ||
      item.remark?.toLowerCase().includes(keywordValue)

    const matchesStatus = !statusFilter.value || String(item.isActive) === statusFilter.value

    return matchesKeyword && matchesStatus
  })
})

const activeCount = computed(() => accounts.value.filter((item) => item.isActive).length)
const inactiveCount = computed(() => accounts.value.filter((item) => !item.isActive).length)

const resetForm = () => {
  editingId.value = null
  form.accountName = ''
  form.bankName = ''
  form.accountNo = ''
  form.remark = ''
  form.isActive = true
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (item: PaymentAccountItem) => {
  editingId.value = item.id
  form.accountName = item.accountName
  form.bankName = item.bankName || ''
  form.accountNo = item.accountNo
  form.remark = item.remark || ''
  form.isActive = item.isActive
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  resetForm()
}

const submit = async () => {
  saving.value = true
  try {
    const payload: PaymentAccountPayload = {
      accountName: form.accountName,
      bankName: form.bankName || undefined,
      accountNo: form.accountNo,
      remark: form.remark || undefined,
      isActive: form.isActive,
    }

    if (editingId.value) {
      await updatePaymentAccount(editingId.value, payload)
      ElMessage.success('收款账户已更新')
    } else {
      await createPaymentAccount(payload)
      ElMessage.success('收款账户已创建')
    }

    closeDialog()
    await loadAccounts()
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (item: PaymentAccountItem, isActive: boolean) => {
  await updatePaymentAccount(item.id, {
    accountName: item.accountName,
    bankName: item.bankName,
    accountNo: item.accountNo,
    remark: item.remark,
    isActive,
  })
  ElMessage.success(isActive ? '收款账户已启用' : '收款账户已停用')
  await loadAccounts()
}

onMounted(loadAccounts)
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>收款配置</template>

      <div class="page-stack">
        <div class="stats-grid">
          <el-card shadow="never">
            <div class="stat-label">账户总数</div>
            <div class="stat-value">{{ accounts.length }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">启用账户</div>
            <div class="stat-value">{{ activeCount }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">停用账户</div>
            <div class="stat-value">{{ inactiveCount }}</div>
          </el-card>
        </div>

        <el-card shadow="never">
          <template #header>筛选条件</template>
          <el-form inline>
            <el-form-item label="关键词">
              <el-input v-model="keyword" placeholder="账户名 / 账号 / 开户行 / 备注" clearable />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 160px">
                <el-option label="启用" value="true" />
                <el-option label="停用" value="false" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button @click="keyword = ''; statusFilter = ''">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>收款账户列表</span>
              <el-button type="primary" @click="openCreateDialog">新增收款账户</el-button>
            </div>
          </template>

          <el-table v-loading="loading" :data="filteredAccounts">
            <el-table-column label="账户名称" prop="accountName" min-width="180" />
            <el-table-column label="开户行" prop="bankName" min-width="180" />
            <el-table-column label="收款账号" prop="accountNo" min-width="220" />
            <el-table-column label="备注" prop="remark" min-width="180" />
            <el-table-column label="状态" min-width="100">
              <template #default="scope">
                <el-tag :type="scope.row.isActive ? 'success' : 'info'">
                  {{ scope.row.isActive ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="180">
              <template #default="scope">
                {{ scope.row.updatedAt?.replace('T', ' ').slice(0, 19) || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="scope">
                <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
                <el-button
                  link
                  :type="scope.row.isActive ? 'warning' : 'success'"
                  @click="toggleStatus(scope.row, !scope.row.isActive)"
                >
                  {{ scope.row.isActive ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑收款账户' : '新增收款账户'" width="640px">
      <el-form label-width="110px" class="form-grid">
        <el-form-item label="账户名称">
          <el-input v-model="form.accountName" placeholder="请输入账户名称" />
        </el-form-item>
        <el-form-item label="开户行">
          <el-input v-model="form.bankName" placeholder="请输入开户行" />
        </el-form-item>
        <el-form-item label="收款账号">
          <el-input v-model="form.accountNo" placeholder="请输入收款账号" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="备注" style="grid-column: 1 / -1">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
