// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';
import clerk from '@clerk/astro';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
    clerk(),
  ],
  vite: {
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    },
    optimizeDeps: {
      include: ['@trpc/client', '@trpc/server', 'superjson'],
    },
  },
});