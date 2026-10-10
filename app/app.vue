<script setup lang="ts">
/* App dark-only — la clase va por useHead (app.head no propaga `class`
   al <html> en SSR); con color-mode desactivado nada la sobrescribe */
useHead({
  htmlAttrs: { class: 'dark' },
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
