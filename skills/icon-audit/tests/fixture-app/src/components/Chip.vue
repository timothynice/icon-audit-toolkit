<script setup lang="ts">
import { IconX } from '../lib/icons'
defineProps<{ label: string }>()
const emit = defineEmits<{ remove: [] }>()
</script>
<template>
  <span class="chip">
    {{ label }}
    <button type="button" aria-label="Remove" @click="emit('remove')"><IconX class="chip-x" /></button>
  </span>
</template>
