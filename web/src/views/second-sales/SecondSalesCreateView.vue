<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)

const goToAssignments = async () => {
  loading.value = true
  try {
    await router.push('/second-sales/assignments')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page-stack">
    <el-card>
      <template #header>二销录业绩</template>
      <el-empty description="请在二销接待列表中，直接点击客户后的“录入二销业绩”进行录入。" />
      <el-button type="primary" :loading="loading" @click="goToAssignments">前往二销接待</el-button>
    </el-card>
  </div>
</template>
