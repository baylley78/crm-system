<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, register } from '../../api/auth'
import { authStorage } from '../../auth'

const router = useRouter()
const loading = ref(false)
const mode = ref<'login' | 'register'>('login')

const loginForm = reactive({
  phone: '',
  password: '',
})

const registerForm = reactive({
  realName: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

const resolveErrorMessage = (error: any, fallback: string) => {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) {
    return message[0] || fallback
  }
  if (typeof message === 'string' && message.trim()) {
    return message
  }
  if (typeof error?.message === 'string' && error.message.trim() && error.message !== 'Network Error') {
    return error.message
  }
  return fallback
}

const submitLogin = async () => {
  if (!loginForm.phone || !loginForm.password) {
    ElMessage.warning('请输入手机号和密码')
    return
  }

  loading.value = true
  try {
    const data = await login(loginForm)
    authStorage.setSession(data.token, data.user)
    ElMessage.success(`欢迎回来，${data.user.realName}`)
    router.replace('/dashboard')
  } catch (error: any) {
    ElMessage.error(resolveErrorMessage(error, '登录失败，请检查手机号和密码'))
  } finally {
    loading.value = false
  }
}

const submitRegister = async () => {
  if (!registerForm.realName || !registerForm.phone || !registerForm.password || !registerForm.confirmPassword) {
    ElMessage.warning('请完整填写注册信息')
    return
  }

  if (registerForm.password !== registerForm.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    const data = await register({
      realName: registerForm.realName,
      phone: registerForm.phone,
      password: registerForm.password,
    })
    ElMessage.success(data.message)
    loginForm.phone = registerForm.phone
    loginForm.password = ''
    registerForm.realName = ''
    registerForm.phone = ''
    registerForm.password = ''
    registerForm.confirmPassword = ''
    mode.value = 'login'
  } catch (error: any) {
    ElMessage.error(resolveErrorMessage(error, '注册失败，请稍后重试'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card">
      <div class="login-title">上民佳律所</div>
      <div class="login-subtitle">{{ mode === 'login' ? '员工手机号登录' : '员工注册申请' }}</div>
      <el-form v-if="mode === 'login'" label-position="top">
        <el-form-item label="手机号">
          <el-input v-model="loginForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" show-password placeholder="请输入密码" @keyup.enter="submitLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="submitLogin">登录系统</el-button>
        </el-form-item>
      </el-form>
      <el-form v-else label-position="top">
        <el-form-item label="姓名">
          <el-input v-model="registerForm.realName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="registerForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="registerForm.password" type="password" show-password placeholder="请输入密码" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="registerForm.confirmPassword" type="password" show-password placeholder="请再次输入密码" @keyup.enter="submitRegister" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" style="width: 100%" @click="submitRegister">提交注册</el-button>
        </el-form-item>
      </el-form>
      <div class="login-switch">
        <el-button link type="primary" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? '没有账号？去注册' : '已有账号？去登录' }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>
