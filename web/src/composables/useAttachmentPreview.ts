import { computed, ref } from 'vue'
import { authStorage } from '../auth'

const resolveFileBaseURL = () => {
  const configured = import.meta.env.VITE_FILE_BASE_URL?.trim() || import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  return 'http://127.0.0.1:3000'
}

const fileBaseURL = resolveFileBaseURL()

const appendTokenToFileUrl = (absoluteUrl: string) => {
  const token = authStorage.getToken()
  if (!token) return absoluteUrl

  const fileBase = new URL(fileBaseURL, window.location.origin)
  const targetUrl = new URL(absoluteUrl, window.location.origin)
  const isSameOriginFile = targetUrl.origin === fileBase.origin && targetUrl.pathname.startsWith('/files/')

  if (!isSameOriginFile) {
    return absoluteUrl
  }

  targetUrl.searchParams.set('token', token)
  return targetUrl.toString()
}

export const toAbsoluteFileUrl = (value?: string) => {
  if (!value) return ''
  const absoluteUrl = value.startsWith('http') ? value : `${fileBaseURL}${value}`
  return appendTokenToFileUrl(absoluteUrl)
}

const imageExtensionPattern = /\.(png|jpe?g|gif|bmp|webp|svg)$/i

export const isImageFile = (value?: string) => Boolean(value && imageExtensionPattern.test(value))

export const getFileName = (value?: string, fallback = '附件文件') => value?.split('/').pop() || fallback

export const useAttachmentPreview = (defaultTitle = '附件预览') => {
  const visible = ref(false)
  const title = ref(defaultTitle)
  const imageUrl = ref('')
  const fileUrl = ref('')
  const downloadUrl = ref('')

  const openPreview = (url?: string, nextTitle = defaultTitle) => {
    const absoluteUrl = toAbsoluteFileUrl(url)
    if (!absoluteUrl) {
      return
    }

    title.value = nextTitle
    downloadUrl.value = absoluteUrl
    if (isImageFile(url)) {
      imageUrl.value = absoluteUrl
      fileUrl.value = ''
    } else {
      imageUrl.value = ''
      fileUrl.value = absoluteUrl
    }
    visible.value = true
  }

  const closePreview = () => {
    visible.value = false
    imageUrl.value = ''
    fileUrl.value = ''
    downloadUrl.value = ''
  }

  return {
    visible,
    title,
    imageUrl,
    fileUrl,
    downloadUrl,
    hasImage: computed(() => Boolean(imageUrl.value)),
    hasFile: computed(() => Boolean(fileUrl.value)),
    openPreview,
    closePreview,
  }
}
