export type AppConfig = {
  port: number;
  webOrigin: string;
  apiOrigin: string;
  redisUrl: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  oidcRedirectUri: string;
  cookieSecure: boolean;
  sessionTtlSeconds: number;
  exportDir: string;
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
};

export function appConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    apiOrigin: process.env.API_ORIGIN ?? 'http://localhost:4000',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    oidcIssuer: process.env.OIDC_ISSUER ?? 'http://localhost:8180/realms/lexbridge',
    oidcClientId: process.env.OIDC_CLIENT_ID ?? 'lexbridge-api',
    oidcClientSecret: process.env.OIDC_CLIENT_SECRET ?? 'lexbridge-dev-secret',
    oidcRedirectUri: process.env.OIDC_REDIRECT_URI ?? 'http://localhost:4000/auth/callback',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 28800),
    exportDir: process.env.EXPORT_DIR ?? 'storage/exports',
    llmApiKey: process.env.LLM_API_KEY ?? '',
    llmBaseUrl: process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
    llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini',
  };
}
