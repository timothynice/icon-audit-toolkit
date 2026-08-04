<script setup lang="ts">
import Banner from '../components/Banner.vue'
import FileRow from '../components/FileRow.vue'
import ListItem from '../components/ListItem.vue'
const files = [
  { name: 'report.pdf', kind: 'doc' as const },
  { name: 'photo.png', kind: 'img' as const },
]
</script>
<template>
  <div class="home">
    <Banner>Welcome back!</Banner>
    <FileRow v-for="f in files" :key="f.name" v-bind="f" />
    <ul>
      <ListItem label="First item" />
      <ListItem label="Second item" />
    </ul>
  </div>
</template>
