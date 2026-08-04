<script setup lang="ts">
import { ref } from 'vue'
import SideNav from './components/SideNav.vue'
import HomePage from './pages/HomePage.vue'
import SettingsPage from './pages/SettingsPage.vue'
const currentView = ref<'home' | 'settings'>('home')
</script>
<template>
  <div id="app">
    <SideNav :active="currentView" @navigate="(v) => (currentView = v)" />
    <main>
      <HomePage v-if="currentView === 'home'" />
      <SettingsPage v-else-if="currentView === 'settings'" />
    </main>
  </div>
</template>
