<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ del: [] }>()
</script>
<template>
  <li class="list-item">
    <span>{{ label }}</span>
    <button type="button" :aria-label="`Delete ${label}`" @click="emit('del')">
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M5.5 4V3a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10.5 3v1M2.5 4h11M4 4l.7 9a1.5 1.5 0 0 0 1.5 1.4h3.6A1.5 1.5 0 0 0 11.3 13l.7-9" />
      </svg>
    </button>
  </li>
</template>
