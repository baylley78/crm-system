<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { getFileName } from '../composables/useAttachmentPreview'

const visible = defineModel<boolean>('visible', { required: true })

const props = withDefaults(
  defineProps<{
    title?: string
    imageUrl?: string
    fileUrl?: string
    downloadUrl?: string
    showDownload?: boolean
    downloadName?: string
  }>(),
  {
    title: '附件预览',
    imageUrl: '',
    fileUrl: '',
    downloadUrl: '',
    showDownload: false,
    downloadName: '',
  },
)

const previewFailed = ref(false)
const imageScale = ref(1)

const resetState = () => {
  previewFailed.value = false
  imageScale.value = 1
}

const handleWheel = (event: WheelEvent) => {
  if (!props.imageUrl || previewFailed.value) {
    return
  }

  event.preventDefault()
  const nextScale = Number((imageScale.value + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))
  imageScale.value = Math.min(4, Math.max(0.5, nextScale))
}

const currentDownloadName = computed(() => props.downloadName || getFileName(props.downloadUrl || props.fileUrl || props.imageUrl))

watch(
  () => [visible.value, props.imageUrl, props.fileUrl],
  ([nextVisible]) => {
    if (nextVisible) {
      resetState()
    }
  },
)
</script>

<template>
  <el-dialog v-model="visible" :title="title" width="800px" @closed="resetState">
    <div class="page-stack-sm">
      <div v-if="imageUrl" class="image-preview-shell" @wheel.prevent="handleWheel">
        <img
          v-if="!previewFailed"
          :src="imageUrl"
          :alt="title"
          class="attachment-preview-image"
          :style="{ transform: `scale(${imageScale})` }"
          @error="previewFailed = true"
        />
        <el-empty v-else description="图片加载失败，请检查上传文件是否存在" />
      </div>
      <div v-else-if="fileUrl" class="page-stack-sm">
        <iframe :src="fileUrl" class="attachment-preview-frame" :title="title" />
      </div>
      <el-empty v-else description="暂无可预览附件" />

      <div v-if="showDownload && downloadUrl" class="attachment-preview-actions">
        <el-link :href="downloadUrl" :download="currentDownloadName" type="primary">
          <el-icon><Download /></el-icon>
          <span>下载 {{ currentDownloadName }}</span>
        </el-link>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.image-preview-shell {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  max-height: 70vh;
  padding: 12px;
}

.attachment-preview-image {
  display: block;
  max-width: 100%;
  max-height: 65vh;
  margin: 0 auto;
  border-radius: 8px;
  transform-origin: center center;
}

.attachment-preview-frame {
  width: 100%;
  height: 70vh;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.attachment-preview-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
