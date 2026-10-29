import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.integration.spec.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://lexbridge:lexbridge@localhost:5432/lexbridge',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      WEB_ORIGIN: 'http://localhost:3000',
      API_ORIGIN: 'http://localhost:4000',
      OIDC_ISSUER: 'http://localhost:8080/realms/lexbridge',
      OIDC_CLIENT_ID: 'lexbridge-api',
      OIDC_CLIENT_SECRET: 'lexbridge-dev-secret',
      OIDC_REDIRECT_URI: 'http://localhost:4000/auth/callback',
      COOKIE_SECURE: 'false',
      SESSION_TTL_SECONDS: '28800',
      EXPORT_DIR: 'storage/exports',
      LLM_API_KEY: '',
    },
  },
});
