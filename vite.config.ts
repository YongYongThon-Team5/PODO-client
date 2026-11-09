import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // 백엔드 쿠키가 SameSite=Strict라 /api를 같은 출처로 보이게 프록시한다 (docs/api-integration.md 2장)
  const apiOrigin = env.API_ORIGIN || 'https://52.78.237.200';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true, secure: true },
      },
    },
  };
});
