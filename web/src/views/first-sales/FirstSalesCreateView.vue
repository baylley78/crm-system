<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(async () => {
  await router.replace('/first-sales/list')
})
</script>

<template>
  <div />
</template>
