<script setup lang="ts">
import { IconPlus } from '../lib/icons'
</script>
<template>
  <!-- Legacy quick-add panel. Superseded by HomePage actions; kept for reference. -->
  <div class="dead-panel">
    <button type="button" title="Add"><IconPlus /></button>
    <img src="/icons/trash-old.svg" alt="Delete" class="dead-trash" />
  </div>
</template>
