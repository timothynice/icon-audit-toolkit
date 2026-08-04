<script setup lang="ts">
import { ref } from 'vue'
const visible = ref(true)
</script>
<template>
  <div v-if="visible" class="banner">
    <slot />
    <button class="banner-dismiss" @click="visible = false">×</button>
  </div>
</template>
