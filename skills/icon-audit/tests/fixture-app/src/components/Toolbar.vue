<script setup lang="ts">
import { computed, ref } from 'vue'
import { IconEyeOff } from '../lib/icons'
type IconKind = 'save' | 'export'
const mode = ref<IconKind>('save')
const label = computed<IconKind>(() => mode.value)
const jobRunning = ref(false)
</script>
<template>
  <div class="toolbar">
    <button type="button" title="Save layout">
      <img src="/icons/save.svg" alt="Save" class="tb-icon" />
    </button>
    <button type="button" class="tb-save-masked" title="Save as copy"></button>
    <button type="button" title="Hide columns"><IconEyeOff /></button>
    <button type="button" class="tb-caret" aria-label="More tools">&#x25BC;</button>
    <span v-if="jobRunning" class="tb-status">⚙️ working…</span>
  </div>
</template>
<style scoped>
.tb-save-masked {
  width: 20px;
  height: 20px;
  background: currentColor;
  -webkit-mask: url('/icons/save.svg') no-repeat center / contain;
  mask: url('/icons/save.svg') no-repeat center / contain;
}
</style>
