<script setup lang="ts">
</script>

<template>
  <div class="home-page">
    <div class="home-hero">
      <img src="/src/assets/homepage-banner.jpg" alt="首页展示图" class="home-hero-image" />
    </div>
  </div>
</template>

<style scoped>
.home-page {
  min-height: calc(100vh - 140px);
  margin: -20px;
  background: #f5f7fa;
}

.home-hero {
  width: 100%;
  min-height: calc(100vh - 140px);
  overflow: hidden;
}

.home-hero-image {
  display: block;
  width: 100%;
  height: calc(100vh - 140px);
  object-fit: cover;
}
</style>
