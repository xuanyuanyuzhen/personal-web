import { createApp } from 'vue';
import App from './App.vue';
import { initLocale } from './composables/useI18n';
import { initTheme } from './composables/useTheme';
import { router } from './router';
import './styles.css';

initTheme();
initLocale();

createApp(App).use(router).mount('#app');
