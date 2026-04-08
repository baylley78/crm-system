<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createDingTalkReportConfig, fetchDingTalkReportConfigs, updateDingTalkReportConfig } from '../../api/dingtalk-report'
import { request } from '../../api/request'
import type { DepartmentTreeItem, DingTalkReportConfigItem, DingTalkReportConfigPayload, DingTalkReportTemplateType } from '../../types'

const FIRST_SALES_TEMPLATE = '【一销报单】\n时间：{{orderTime}}\n客户姓名：{{customerName}}\n手机：{{maskedPhone}}\n业绩类型：{{orderType}}\n是否及时：{{isTimelyDeal}}\n付款金额：{{paymentAmount}}\n今日单量：{{dailyOrderCount}}\n今日总业绩：{{dailyPaymentAmount}}'
const LITIGATION_TEMPLATE = '【{{stage}}】\n时间：{{orderTime}}\n客户姓名：{{customerName}}\n销售：{{salesName}}\n回款金额：{{paymentAmount}}\n实际业绩：{{performanceAmount}}\n今日目标：{{dailyTarget}}\n\n{{departmentName}}今日业绩播报：\n{{departmentDailyPerformanceLines}}\n\n今日二销合计：{{departmentDailyPerformanceTotal}}元'
const TEMPLATE_TYPE_OPTIONS: Array<{ label: string; value: DingTalkReportTemplateType }> = [
  { label: '一销报单', value: 'FIRST_SALES' },
  { label: '二销/三销报单', value: 'LITIGATION' },
]

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const keyword = ref('')
const configs = ref<DingTalkReportConfigItem[]>([])
const departmentOptions = ref<Array<{ id: number; name: string }>>([])
const templateVariables = ['{{stage}}', '{{customerName}}', '{{phone}}', '{{maskedPhone}}', '{{salesName}}', '{{departmentName}}', '{{groupName}}', '{{teamName}}', '{{branchName}}', '{{paymentAmount}}', '{{performanceAmount}}', '{{orderTime}}', '{{orderType}}', '{{isTimelyDeal}}', '{{dailyOrderCount}}', '{{dailyPaymentAmount}}', '{{teamDailyPaymentAmount}}', '{{departmentDailyPerformanceLines}}', '{{departmentDailyPerformanceTotal}}', '{{dailyTarget}}']

const form = reactive<DingTalkReportConfigPayload>({
  templateType: 'FIRST_SALES',
  departmentIds: [],
  departmentNames: [],
  webhookUrl: '',
  dailyTarget: '',
  messageTemplate: FIRST_SALES_TEMPLATE,
  isActive: true,
})

const flattenDepartments = (nodes: DepartmentTreeItem[], prefix = ''): Array<{ id: number; name: string }> =>
  nodes.flatMap((item) => {
    const currentName = prefix ? `${prefix} / ${item.name}` : item.name
    return [
      { id: item.id, name: currentName },
      ...flattenDepartments(item.children || [], currentName),
    ]
  })

const templateTypeLabelMap: Record<DingTalkReportTemplateType, string> = {
  FIRST_SALES: '一销报单',
  LITIGATION: '二销/三销报单',
}

const getTemplateTypeLabel = (templateType: DingTalkReportTemplateType) => templateTypeLabelMap[templateType]
const getDefaultTemplate = (templateType: DingTalkReportTemplateType) =>
  templateType === 'FIRST_SALES' ? FIRST_SALES_TEMPLATE : LITIGATION_TEMPLATE

const loadConfigs = async () => {
  loading.value = true
  try {
    configs.value = await fetchDingTalkReportConfigs()
  } finally {
    loading.value = false
  }
}

const loadDepartments = async () => {
  const { data } = await request.get<DepartmentTreeItem[]>('/departments/tree')
  departmentOptions.value = flattenDepartments(data)
}

const filteredConfigs = computed(() => {
  const keywordValue = keyword.value.trim().toLowerCase()
  return configs.value.filter((item) => {
    if (!keywordValue) {
      return true
    }

    return (
      item.departmentNames.join(' / ').toLowerCase().includes(keywordValue) ||
      templateTypeLabelMap[item.templateType].toLowerCase().includes(keywordValue) ||
      item.messageTemplate.toLowerCase().includes(keywordValue) ||
      item.webhookUrl.toLowerCase().includes(keywordValue)
    )
  })
})

const resetForm = () => {
  editingId.value = null
  form.templateType = 'FIRST_SALES'
  form.departmentIds = []
  form.departmentNames = []
  form.webhookUrl = ''
  form.dailyTarget = ''
  form.messageTemplate = FIRST_SALES_TEMPLATE
  form.isActive = true
}

const openCreateDialog = () => {
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (item: DingTalkReportConfigItem) => {
  editingId.value = item.id
  form.templateType = item.templateType
  form.departmentIds = [...item.departmentIds]
  form.departmentNames = [...item.departmentNames]
  form.webhookUrl = item.webhookUrl
  form.dailyTarget = item.dailyTarget || ''
  form.messageTemplate = item.messageTemplate
  form.isActive = item.isActive
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
  resetForm()
}

const handleDepartmentChange = (values: number[]) => {
  const selected = departmentOptions.value.filter((item) => values.includes(item.id))
  form.departmentNames = selected.map((item) => item.name)
}

const handleTemplateTypeChange = (value: DingTalkReportTemplateType) => {
  if (value === 'FIRST_SALES') {
    form.dailyTarget = ''
  }

  if (!editingId.value) {
    form.messageTemplate = getDefaultTemplate(value)
  }
}

const submit = async () => {
  saving.value = true
  try {
    const payload: DingTalkReportConfigPayload = {
      templateType: form.templateType,
      departmentIds: form.departmentIds,
      departmentNames: form.departmentNames,
      webhookUrl: form.webhookUrl,
      dailyTarget: form.templateType === 'LITIGATION' ? form.dailyTarget || undefined : undefined,
      messageTemplate: form.messageTemplate,
      isActive: form.isActive,
    }

    if (editingId.value) {
      await updateDingTalkReportConfig(editingId.value, payload)
      ElMessage.success('钉钉报单配置已更新')
    } else {
      await createDingTalkReportConfig(payload)
      ElMessage.success('钉钉报单配置已创建')
    }

    closeDialog()
    await loadConfigs()
  } finally {
    saving.value = false
  }
}

const toggleStatus = async (item: DingTalkReportConfigItem, isActive: boolean) => {
  await updateDingTalkReportConfig(item.id, { isActive })
  ElMessage.success(isActive ? '钉钉报单已启用' : '钉钉报单已停用')
  await loadConfigs()
}

onMounted(async () => {
  await Promise.all([loadConfigs(), loadDepartments()])
})
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>钉钉报单</template>

      <div class="page-stack">
        <el-card shadow="never">
          <template #header>变量说明</template>
          <div class="variable-list">
            <el-tag v-for="item in templateVariables" :key="item">{{ item }}</el-tag>
          </div>
          <el-alert title="系统会在一销、二销、三销新增业绩后，按销售所属部门和模板类型匹配 webhook 并自动推送报单。一销模板支持时间、客户姓名、脱敏手机号、业绩类型、是否及时、今日单量、今日总业绩等变量；二销/三销模板支持部门成员今日业绩明细、今日二销合计和配置级今日目标变量。" type="info" :closable="false" show-icon />
        </el-card>

        <el-card shadow="never">
          <template #header>筛选条件</template>
          <el-form inline>
            <el-form-item label="关键词">
              <el-input v-model="keyword" placeholder="部门 / 模板类型 / webhook / 模板内容" clearable />
            </el-form-item>
            <el-form-item>
              <el-button @click="keyword = ''">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="header-row">
              <span>配置列表</span>
              <el-button type="primary" @click="openCreateDialog">新增钉钉报单</el-button>
            </div>
          </template>

          <el-table v-loading="loading" :data="filteredConfigs">
            <el-table-column label="模板类型" min-width="140">
              <template #default="scope">{{ getTemplateTypeLabel(scope.row.templateType) }}</template>
            </el-table-column>
            <el-table-column label="对应部门" min-width="260" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.departmentNames.join(' / ') }}</template>
            </el-table-column>
            <el-table-column label="Webhook" min-width="260" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.webhookUrl }}</template>
            </el-table-column>
            <el-table-column label="今日目标" min-width="140" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.dailyTarget || '-' }}</template>
            </el-table-column>
            <el-table-column label="报单模板" min-width="360" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.messageTemplate }}</template>
            </el-table-column>
            <el-table-column label="状态" min-width="100">
              <template #default="scope">
                <el-tag :type="scope.row.isActive ? 'success' : 'info'">{{ scope.row.isActive ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="180">
              <template #default="scope">{{ scope.row.updatedAt?.replace('T', ' ').slice(0, 19) || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="scope">
                <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
                <el-button link :type="scope.row.isActive ? 'warning' : 'success'" @click="toggleStatus(scope.row, !scope.row.isActive)">
                  {{ scope.row.isActive ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑钉钉报单' : '新增钉钉报单'" width="760px">
      <el-form label-width="110px" class="form-grid">
        <el-form-item label="模板类型">
          <el-select v-model="form.templateType" placeholder="请选择模板类型" @change="handleTemplateTypeChange">
            <el-option v-for="item in TEMPLATE_TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="停用" />
        </el-form-item>
        <el-form-item label="对应部门" style="grid-column: 1 / -1">
          <el-select v-model="form.departmentIds" placeholder="请选择部门" multiple filterable collapse-tags collapse-tags-tooltip @change="handleDepartmentChange">
            <el-option v-for="item in departmentOptions" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Webhook" style="grid-column: 1 / -1">
          <el-input v-model="form.webhookUrl" placeholder="请输入钉钉群机器人 webhook" />
        </el-form-item>
        <el-form-item v-if="form.templateType === 'LITIGATION'" label="今日目标" style="grid-column: 1 / -1">
          <el-input v-model="form.dailyTarget" placeholder="请输入该群今日目标，如 182000元" />
        </el-form-item>
        <el-form-item :label="getTemplateTypeLabel(form.templateType)" style="grid-column: 1 / -1">
          <el-input v-model="form.messageTemplate" type="textarea" :rows="8" placeholder="请输入报单模板" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.variable-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
