import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      // 本地开发时把前台的 /api 请求转发到 NestJS，避免落到 Vite dev server 返回 404。
      '/api': {
        changeOrigin: true,
        target: 'http://127.0.0.1:3000',
      },
    },
  },
  preview: {
    port: 5173,
  },
});
