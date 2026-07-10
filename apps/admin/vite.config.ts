import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5174,
    proxy: {
      // 后台管理同样复用本地 API 代理，保证登录和内容管理请求走 NestJS。
      '/api': {
        changeOrigin: true,
        target: 'http://127.0.0.1:3000',
      },
    },
  },
  preview: {
    port: 5174,
  },
});
