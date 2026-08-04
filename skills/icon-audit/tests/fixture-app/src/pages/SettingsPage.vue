<script setup lang="ts">
/**
 * Settings surface. Icon names resolve through AnyIcon, e.g. 'IconExample'
 * would render whatever the registry exposes under that key.
 */
import { ref } from 'vue'
import Toolbar from '../components/Toolbar.vue'
import Form from '../components/Form.vue'
import Modal from '../components/Modal.vue'
import Chip from '../components/Chip.vue'
const tags = ref(['alpha', 'beta'])
const showModal = ref(false)
</script>
<template>
  <div class="settings">
    <Toolbar />
    <Form />
    <Chip v-for="t in tags" :key="t" :label="t" @remove="tags = tags.filter((x) => x !== t)" />
    <Modal v-if="showModal" @close="showModal = false"><template #title>About</template></Modal>
  </div>
</template>
