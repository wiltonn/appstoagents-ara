/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly CLERK_SECRET_KEY: string;
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly OPENAI_API_KEY: string;
  readonly CLOUDFLARE_R2_ACCESS_KEY_ID: string;
  readonly CLOUDFLARE_R2_SECRET_ACCESS_KEY: string;
  readonly CLOUDFLARE_R2_BUCKET_NAME: string;
  readonly CLOUDFLARE_R2_ENDPOINT: string;
  readonly UPSTASH_REDIS_URL: string;
  readonly UPSTASH_REDIS_TOKEN: string;
  readonly KV_URL: string;
  readonly KV_REST_API_URL: string;
  readonly KV_REST_API_TOKEN: string;
  readonly KV_REST_API_READ_ONLY_TOKEN: string;
  readonly NODE_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}