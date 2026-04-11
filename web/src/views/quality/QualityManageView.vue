<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { hasPermission, formatPhone } from '../../utils/permissions'
import { createQualityRecord, fetchQualityRecords, fetchQualityResponsibles } from '../../api/quality'
import { authStorage } from '../../auth'
import { toAbsoluteFileUrl } from '../../composables/useAttachmentPreview'
import type { QualityCreatePayload, QualityRecordItem, QualityResponsibleOption } from '../../types'

const canCreateQuality = () => hasPermission('quality.create')

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const records = ref<QualityRecordItem[]>([])
const responsibleOptions = ref<QualityResponsibleOption[]>([])
const filterCollapse = ref<string[]>(['create'])
const currentPage = ref(1)
const pageSize = ref(30)
const pageSizeOptions = [30, 50, 100]
const filters = reactive({
  responsibleId: undefined as number | undefined,
})
const complaintContext = reactive({
  customerId: undefined as number | undefined,
  customerName: '',
  phone: '',
  judicialComplaintCaseId: undefined as number | undefined,
  complaintSubject: '',
  complaintReason: '',
})
const form = reactive<QualityCreatePayload>({
  recordDate: new Date().toISOString().slice(0, 10),
  responsibleId: authStorage.getUser()?.id || 0,
  customerId: undefined,
  judicialComplaintCaseId: undefined,
  matter: '',
  penaltyAmount: 0,
  screenshot: null,
})
const screenshotFileList = ref<UploadFile[]>([])
const screenshotPreviewUrl = ref('')
const previewVisible = ref(false)
const previewImageUrl = ref('')

const hasComplaintContext = computed(() => Boolean(complaintContext.customerId || complaintContext.judicialComplaintCaseId))

const applyRouteContext = () => {
  const customerId = Number(route.query.customerId || '')
  const judicialComplaintCaseId = Number(route.query.judicialComplaintCaseId || '')
  complaintContext.customerId = Number.isFinite(customerId) && customerId > 0 ? customerId : undefined
  complaintContext.customerName = typeof route.query.customerName === 'string' ? route.query.customerName : ''
  complaintContext.phone = typeof route.query.phone === 'string' ? route.query.phone : ''
  complaintContext.judicialComplaintCaseId = Number.isFinite(judicialComplaintCaseId) && judicialComplaintCaseId > 0 ? judicialComplaintCaseId : undefined
  complaintContext.complaintSubject = typeof route.query.complaintSubject === 'string' ? route.query.complaintSubject : ''
  complaintContext.complaintReason = typeof route.query.complaintReason === 'string' ? route.query.complaintReason : ''

  form.customerId = complaintContext.customerId
  form.judicialComplaintCaseId = complaintContext.judicialComplaintCaseId
  if (hasComplaintContext.value && !form.matter.trim()) {
    form.matter = `司法投诉质检：客户${complaintContext.customerName || ''}${complaintContext.complaintSubject ? `，投诉主体：${complaintContext.complaintSubject}` : ''}${complaintContext.complaintReason ? `，投诉原因：${complaintContext.complaintReason}` : ''}`.trim()
  }
}

const loadResponsibles = async () => {
  responsibleOptions.value = await fetchQualityResponsibles()
  if (!form.responsibleId && responsibleOptions.value[0]) {
    form.responsibleId = responsibleOptions.value[0].id
  }
}

const loadRecords = async () => {
  loading.value = true
  try {
    records.value = await fetchQualityRecords(filters.responsibleId)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.recordDate = new Date().toISOString().slice(0, 10)
  form.responsibleId = authStorage.getUser()?.id || responsibleOptions.value[0]?.id || 0
  form.customerId = complaintContext.customerId
  form.judicialComplaintCaseId = complaintContext.judicialComplaintCaseId
  form.matter = hasComplaintContext.value
    ? `司法投诉质检：客户${complaintContext.customerName || ''}${complaintContext.complaintSubject ? `，投诉主体：${complaintContext.complaintSubject}` : ''}${complaintContext.complaintReason ? `，投诉原因：${complaintContext.complaintReason}` : ''}`.trim()
    : ''
  form.penaltyAmount = 0
  form.screenshot = null
  screenshotFileList.value = []
  screenshotPreviewUrl.value = ''
}

const resetFilters = async () => {
  filters.responsibleId = undefined
  currentPage.value = 1
  await loadRecords()
}

const clearComplaintContext = async () => {
  await router.replace({ path: route.path })
}

const handleScreenshotChange = (file: { raw?: File }) => {
  form.screenshot = file.raw || null
  screenshotPreviewUrl.value = file.raw ? URL.createObjectURL(file.raw) : ''
  screenshotFileList.value = file.raw
    ? [
        {
          name: file.raw.name,
          url: screenshotPreviewUrl.value,
          raw: file.raw,
        } as UploadFile,
      ]
    : []
}

const handleScreenshotRemove = () => {
  form.screenshot = null
  screenshotFileList.value = []
  screenshotPreviewUrl.value = ''
}

const handleScreenshotPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  const file = Array.from(event.clipboardData?.items || [])
    .map((item) => item.getAsFile())
    .find((item): item is File => Boolean(item))

  if (!file) {
    ElMessage.warning('请先复制违规截图，再粘贴到上传区域')
    return
  }

  handleScreenshotChange({ raw: file })
  ElMessage.success('违规截图已粘贴')
}

const openPreview = (url?: string) => {
  const absoluteUrl = toAbsoluteFileUrl(url)
  if (!absoluteUrl) {
    return
  }
  previewImageUrl.value = absoluteUrl
  previewVisible.value = true
}

const submit = async () => {
  saving.value = true
  try {
    await createQualityRecord({
      recordDate: form.recordDate,
      responsibleId: form.responsibleId,
      customerId: form.customerId,
      judicialComplaintCaseId: form.judicialComplaintCaseId,
      matter: form.matter,
      penaltyAmount: Number(form.penaltyAmount || 0),
      screenshot: form.screenshot,
    })
    ElMessage.success('质检记录已保存')
    const complaintCaseId = form.judicialComplaintCaseId
    resetForm()
    await Promise.all([loadResponsibles(), loadRecords()])
    if (complaintCaseId) {
      await router.push('/after-sales/judicial-complaints')
    }
  } finally {
    saving.value = false
  }
}

const totalCount = computed(() => records.value.length)
const totalPenalty = computed(() => records.value.reduce((sum, item) => sum + Number(item.penaltyAmount || 0), 0))
const todayCount = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return records.value.filter((item) => item.recordDate?.slice(0, 10) === today).length
})
const formattedPenalty = computed(() => `¥${totalPenalty.value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return records.value.slice(start, start + pageSize.value)
})

watch(records, (value) => {
  const totalPages = Math.max(1, Math.ceil(value.length / pageSize.value))
  if (currentPage.value > totalPages) {
    currentPage.value = totalPages
  }
}, { immediate: true })

watch(pageSize, () => {
  currentPage.value = 1
})

watch(() => route.fullPath, () => {
  applyRouteContext()
})

onMounted(async () => {
  applyRouteContext()
  await Promise.all([loadResponsibles(), loadRecords()])
})
</script>

<template>
  <div class="page-stack quality-manage-view">
    <el-card>
      <template #header>质检管理</template>

      <div class="page-stack">
        <div class="stats-grid">
          <el-card shadow="never">
            <div class="stat-label">质检记录数</div>
            <div class="stat-value">{{ totalCount }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">今日新增</div>
            <div class="stat-value">{{ todayCount }}</div>
          </el-card>
          <el-card shadow="never">
            <div class="stat-label">处罚金额合计</div>
            <div class="stat-value danger">{{ formattedPenalty }}</div>
          </el-card>
        </div>

        <el-card shadow="never">
          <template #header>筛选面板</template>
          <el-form inline>
            <el-form-item label="责任人">
              <el-select v-model="filters.responsibleId" placeholder="全部员工" clearable filterable style="width: 220px">
                <el-option v-for="item in responsibleOptions" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadRecords">查询</el-button>
              <el-button @click="resetFilters">重置</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-collapse v-if="canCreateQuality()" v-model="filterCollapse">
          <el-collapse-item name="create">
            <template #title>新增质检记录</template>
            <el-card shadow="never">
              <el-alert
                v-if="hasComplaintContext"
                type="warning"
                show-icon
                :closable="false"
                class="complaint-context-alert"
              >
                <template #title>当前为司法投诉质检</template>
                <div>客户：{{ complaintContext.customerName || '-' }} / {{ formatPhone(complaintContext.phone) }}</div>
                <div>投诉单ID：{{ complaintContext.judicialComplaintCaseId || '-' }}</div>
                <div class="alert-actions">
                  <el-button link type="primary" @click="clearComplaintContext">清除带入信息</el-button>
                </div>
              </el-alert>
              <el-form label-width="100px" class="form-grid">
                <el-form-item label="日期">
                  <el-date-picker v-model="form.recordDate" type="date" value-format="YYYY-MM-DD" placeholder="请选择日期" style="width: 100%" />
                </el-form-item>
                <el-form-item label="责任人">
                  <el-select v-model="form.responsibleId" placeholder="请选择责任人" filterable style="width: 100%">
                    <el-option v-for="item in responsibleOptions" :key="item.id" :label="item.name" :value="item.id" />
                  </el-select>
                </el-form-item>
                <el-form-item label="处罚金额">
                  <el-input v-model.number="form.penaltyAmount" type="number" min="0" placeholder="请输入处罚金额" />
                </el-form-item>
                <el-form-item v-if="hasComplaintContext" label="绑定客户">
                  <div class="static-text">{{ complaintContext.customerName || '-' }}</div>
                </el-form-item>
                <el-form-item label="违规截图" style="grid-column: 1 / -1">
                  <div class="page-stack-sm full-width upload-panel">
                    <div class="paste-upload-box" tabindex="0" @paste="handleScreenshotPaste">复制图片后，在这里按 Ctrl+V 粘贴违规截图</div>
                    <img v-if="screenshotPreviewUrl" :src="screenshotPreviewUrl" alt="违规截图预览" class="screenshot-preview" />
                    <el-upload :auto-upload="false" :show-file-list="true" :limit="1" :file-list="screenshotFileList" :on-change="handleScreenshotChange" :on-remove="handleScreenshotRemove">
                      <el-button>上传</el-button>
                    </el-upload>
                  </div>
                </el-form-item>
                <el-form-item label="事宜" style="grid-column: 1 / -1">
                  <el-input v-model="form.matter" type="textarea" :rows="4" placeholder="请输入质检事宜" />
                </el-form-item>
              </el-form>
              <div class="actions-row">
                <el-button @click="resetForm">重置</el-button>
                <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
              </div>
            </el-card>
          </el-collapse-item>
        </el-collapse>

        <el-card shadow="never">
          <template #header>质检记录列表</template>
          <el-table v-loading="loading" :data="paginatedRecords">
            <el-table-column label="日期" min-width="140">
              <template #default="scope">
                {{ scope.row.recordDate?.slice(0, 10) || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="责任人" prop="responsibleName" min-width="140" />
            <el-table-column label="客户" min-width="160">
              <template #default="scope">
                {{ scope.row.customerName || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="事宜" prop="matter" min-width="320" show-overflow-tooltip />
            <el-table-column label="处罚金额" min-width="140">
              <template #default="scope">
                ¥{{ Number(scope.row.penaltyAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </template>
            </el-table-column>
            <el-table-column label="违规截图" min-width="140">
              <template #default="scope">
                <el-button v-if="scope.row.screenshotUrl" link type="primary" @click="openPreview(scope.row.screenshotUrl)">截图</el-button>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="录入时间" min-width="180">
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
              :total="records.length"
              layout="total, sizes, prev, pager, next, jumper"
              background
            />
          </div>
        </el-card>
      </div>
    </el-card>
    <el-dialog v-model="previewVisible" title="违规截图预览" width="720px">
      <img v-if="previewImageUrl" :src="previewImageUrl" alt="违规截图预览" class="preview-image" />
    </el-dialog>
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.upload-panel {
  width: 100%;
}

.paste-upload-box {
  padding: 16px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  outline: none;
}

.screenshot-preview,
.preview-image {
  display: block;
  max-width: 100%;
  max-height: 320px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
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

.stat-value.danger {
  color: var(--el-color-danger);
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.complaint-context-alert {
  margin-bottom: 16px;
}

.alert-actions {
  margin-top: 6px;
}

.static-text {
  min-height: 32px;
  display: flex;
  align-items: center;
  color: var(--el-text-color-primary);
}
</style>
