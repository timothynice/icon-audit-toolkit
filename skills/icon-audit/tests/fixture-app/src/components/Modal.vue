<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <div class="modal">
    <header>
      <h2><slot name="title" /></h2>
      <button type="button" class="modal-close" aria-label="Close" @click="emit('close')">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
        </svg>
      </button>
    </header>
    <div class="modal-body"><slot /></div>
  </div>
</template>
