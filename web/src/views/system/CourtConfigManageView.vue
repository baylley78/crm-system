<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchCourtConfig, saveCourtConfig } from '../../api/court-config'
import type { CourtConfigPayload } from '../../types'

const loading = ref(false)
const saving = ref(false)
const form = reactive<CourtConfigPayload>({
  hearingCost: 0,
  remark: '',
})
const updatedAt = ref('')

const formattedCost = computed(() => `¥${Number(form.hearingCost || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

const loadConfig = async () => {
  loading.value = true
  try {
    const data = await fetchCourtConfig()
    form.hearingCost = data.hearingCost
    form.remark = data.remark || ''
    updatedAt.value = data.updatedAt
  } finally {
    loading.value = false
  }
}

const submit = async () => {
  saving.value = true
  try {
    const data = await saveCourtConfig({
      hearingCost: Number(form.hearingCost || 0),
      remark: form.remark || undefined,
    })
    form.hearingCost = data.hearingCost
    form.remark = data.remark || ''
    updatedAt.value = data.updatedAt
    ElMessage.success('开庭配置已保存')
  } finally {
    saving.value = false
  }
}

onMounted(loadConfig)
</script>

<template>
  <div class="page-stack" v-loading="loading">
    <el-card>
      <template #header>开庭配置</template>

      <div class="page-stack">
        <div class="stats-grid">
          <el-card shadow="never">
            <div class="stat-label">当前开庭成本</div>
            <div class="stat-value">{{ formattedCost }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">最近更新时间</div>
            <div class="stat-subtitle">{{ updatedAt?.replace('T', ' ').slice(0, 19) || '-' }}</div>
          </el-card>
        </div>

        <el-card shadow="never">
          <template #header>配置说明</template>
          <el-alert title="这里维护全局固定开庭成本。三销录入业绩时，系统会自动按：原始业绩 - 开庭成本 = 实际业绩。" type="info" :closable="false" show-icon />
        </el-card>

        <el-card shadow="never">
          <template #header>成本设置</template>
          <el-form label-width="110px" class="form-grid">
            <el-form-item label="开庭成本">
              <el-input v-model.number="form.hearingCost" type="number" min="0" placeholder="请输入开庭成本" />
            </el-form-item>
            <el-form-item label="备注" style="grid-column: 1 / -1">
              <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注说明" />
            </el-form-item>
          </el-form>
          <div class="actions-row">
            <el-button type="primary" :loading="saving" @click="submit">保存配置</el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--el-color-primary);
}

.stat-subtitle {
  margin-top: 8px;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}
</style>
