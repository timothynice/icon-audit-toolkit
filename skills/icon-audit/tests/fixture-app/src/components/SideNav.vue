<script setup lang="ts">
import AnyIcon from '../lib/icons/AnyIcon.vue'
import type { AllIcons } from '../lib/icons'
defineProps<{ active: string }>()
const emit = defineEmits<{ navigate: [id: string] }>()
const navItems: { id: string; label: string; icon: keyof typeof AllIcons }[] = [
  { id: 'home', label: 'Home', icon: 'IconSearch' },
  { id: 'settings', label: 'Settings', icon: 'IconEyeOff' },
]
</script>
<template>
  <nav>
    <button v-for="item in navItems" :key="item.id" :class="{ active: active === item.id }" @click="emit('navigate', item.id)">
      <AnyIcon :icon="item.icon" /><span>{{ item.label }}</span>
    </button>
    <!-- Theme row: an eye toggles dark mode -->
    <button class="theme-row" title="Theme" @click="$emit('navigate', 'theme')">
      <AnyIcon icon="IconEye" /><span>Theme</span>
    </button>
  </nav>
</template>
