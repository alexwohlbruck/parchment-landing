<script setup lang="ts">
import { Toaster } from "@/components/ui/sonner";
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
    <Toaster position="top-center" rich-colors close-button />
  </NuxtLayout>
</template>
