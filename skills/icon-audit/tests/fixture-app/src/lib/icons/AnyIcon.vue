<script setup lang="ts">
import type { Component } from "vue";
import { AllIcons } from ".";
import { watchEffect, shallowRef } from "vue";
const props = defineProps<{ icon?: keyof typeof AllIcons }>();
const iconComponent = shallowRef<Component | null>(null);
watchEffect(async () => {
	if (props.icon) iconComponent.value = await (AllIcons as any)[props.icon];
});
</script>
<template>
	<component v-if="iconComponent" :is="iconComponent" />
</template>
