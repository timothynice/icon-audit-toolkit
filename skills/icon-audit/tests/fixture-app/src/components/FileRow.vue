<script setup lang="ts">
import { IconTrash } from '../lib/icons'
import AnyIcon from '../lib/icons/AnyIcon.vue'
const props = defineProps<{ name: string; kind: 'doc' | 'img' | 'ghost' }>()
const emit = defineEmits<{ remove: [] }>()
const kindIcon: Record<string, string> = {
  doc: 'IconSearch',
  img: 'IconEye',
  ghost: 'IconGhost',
}
</script>
<template>
  <div class="file-row">
    <AnyIcon :icon="kindIcon[props.kind]" class="kind-icon" />
    <span>{{ props.name }}</span>
    <button type="button" title="Delete file" @click="emit('remove')"><IconTrash /></button>
  </div>
</template>
