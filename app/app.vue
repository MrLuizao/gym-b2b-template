<script setup lang="ts">
/* App dark-only — la clase va por useHead (app.head no propaga `class`
   al <html> en SSR); con color-mode desactivado nada la sobrescribe */
useHead({
  htmlAttrs: { class: 'dark' },
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
  </NuxtLayout>
</template>

<style>
/* Transición de página — fade + leve ascenso; hace que el aterrizaje
   tras el wipe del login (y cualquier navegación) no sea un corte seco. */
.page-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.page-leave-to {
  opacity: 0;
}
</style>
