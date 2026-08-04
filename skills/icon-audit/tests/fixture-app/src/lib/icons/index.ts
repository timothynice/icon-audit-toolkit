import { defineAsyncComponent } from "vue";

export const IconTrash = defineAsyncComponent(() => import("./IconTrash.vue"));
export const IconX = defineAsyncComponent(() => import("./IconX.vue"));
export const IconEye = defineAsyncComponent(() => import("./IconEye.vue"));
export const IconEyeOff = defineAsyncComponent(
	() => import("./IconEyeOff.vue"),
);
const IconPlus = defineAsyncComponent(() => import("./IconPlus.vue"));
const IconSearch = defineAsyncComponent(() => import("./IconSearch.vue"));
export { IconPlus, IconSearch };

import * as list from ".";
export const AllIcons = list;
