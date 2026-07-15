<script setup lang="ts">
import { onMounted, ref } from 'vue';
import PageLoadingSkeleton from '../components/PageLoadingSkeleton.vue';
import { useI18n } from '../composables/useI18n';
import { publicApi, type SiteSettings } from '../services/api';

const { t } = useI18n();
const settings = ref<SiteSettings | null>(null);
const isLoading = ref(true);

onMounted(async () => {
  try {
    settings.value = await publicApi.getSiteSettings();
  } catch {
    settings.value = null;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <section
    class="about-page"
    aria-labelledby="about-title"
  >
    <template v-if="isLoading">
      <p class="page-placeholder-eyebrow">
        {{ t('nav.about') }}
      </p>
      <h1 id="about-title">
        {{ t('page.about.title') }}
      </h1>
    </template>
    <PageLoadingSkeleton
      v-if="isLoading"
      variant="profile"
      label="正在整理个人资料…"
    />

    <template v-else>
      <div class="about-profile">
        <div
          class="about-avatar"
          aria-hidden="true"
        >
          <img
            v-if="settings?.avatarUrl"
            :src="settings.avatarUrl"
            alt=""
          >
          <span v-else>{{ (settings?.publicName || '语').slice(0, 1) }}</span>
        </div>
        <div>
          <p class="page-placeholder-eyebrow">
            {{ t('nav.about') }}
          </p>
          <h1 id="about-title">
            {{ settings?.publicName || t('page.about.title') }}
          </h1>
          <a
            v-if="settings?.githubUrl"
            class="about-link"
            :href="settings.githubUrl"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="custom-page-content"
        v-html="settings?.aboutContent || t('page.about.body')"
      />
      <!-- eslint-enable vue/no-v-html -->
    </template>
  </section>
</template>
