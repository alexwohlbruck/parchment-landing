<template>
  <nav
    class="fixed top-4 z-20 w-[95%] rounded-full border border-white/60 bg-white/40 px-4 py-2 text-sm text-base-dark shadow-[0_1px_2px_rgba(63,47,30,0.12)] backdrop-blur-xl md:w-[80%] lg:w-[60%]"
    aria-label="Primary"
    style="left: 50%; transform: translate(-50%, 0)"
  >
    <div class="flex items-center justify-between">
      <slot name="brand" />
      <ul class="hidden gap-6 md:flex">
        <slot />
      </ul>
      <slot name="cta" />
    </div>
  </nav>
</template>
