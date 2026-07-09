<script setup>
defineProps({
  body: {
    type: String,
    required: true,
  },
  eyebrow: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <section
    class="page-placeholder"
    aria-labelledby="page-title"
  >
    <p
      v-if="eyebrow"
      class="page-placeholder-eyebrow"
    >
      {{ eyebrow }}
    </p>
    <h1 id="page-title">
      {{ title }}
    </h1>
    <p>{{ body }}</p>
    <div
      class="page-placeholder-skeleton"
      aria-hidden="true"
    >
      <span />
      <span />
      <span />
    </div>
  </section>
</template>
