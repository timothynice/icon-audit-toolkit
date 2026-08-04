<script setup lang="ts">
import { ref } from 'vue'
const region = ref('east')
</script>
<template>
  <label>
    Region
    <select v-model="region" class="form-select">
      <option value="east">East</option>
      <option value="west">West</option>
    </select>
  </label>
</template>
<style scoped>
.form-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 24px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888888' fill='none'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}
</style>
