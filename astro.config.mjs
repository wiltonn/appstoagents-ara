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
    // Performance optimizations for Vercel
    maxDuration: 30,
    includeFiles: ['./src/generated/**/*'],
    excludeFiles: ['./src/test/**/*'],
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
    
    // Bundle optimization
    build: {
      rollupOptions: {
        output: {
          // Code splitting strategy
          manualChunks: (id) => {
            // Vendor chunks
            if (id.includes('node_modules')) {
              // React ecosystem
              if (id.includes('react') || id.includes('@tanstack')) {
                return 'react-vendor';
              }
              // Database and caching
              if (id.includes('prisma') || id.includes('ioredis')) {
                return 'data-vendor';
              }
              // PDF and file processing
              if (id.includes('puppeteer') || id.includes('@aws-sdk')) {
                return 'pdf-vendor';
              }
              // Authentication
              if (id.includes('@clerk') || id.includes('jose')) {
                return 'auth-vendor';
              }
              // Other vendor libraries
              return 'vendor';
            }
            
            // Feature-based chunks
            if (id.includes('/wizard/')) {
              return 'wizard';
            }
            if (id.includes('/chat/')) {
              return 'chat';
            }
            if (id.includes('/reports/') || id.includes('/pdf/')) {
              return 'reports';
            }
            if (id.includes('/admin/')) {
              return 'admin';
            }
          },
          
          // Optimize chunk file names
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? 
              chunkInfo.facadeModuleId.split('/').pop().replace('.ts', '').replace('.tsx', '') : 
              'chunk';
            return `chunks/[name]-[hash].js`;
          },
        },
      },
      
      // Bundle size limits
      chunkSizeWarningLimit: 500, // KB
      
      // Minification options
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug'],
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      },
    },
    
    // Dependency optimization
    optimizeDeps: {
      include: [
        '@trpc/client', 
        '@trpc/server', 
        'superjson',
        '@tanstack/react-query',
        'react',
        'react-dom',
        'zustand',
      ],
      exclude: [
        'puppeteer', // Heavy dependency, load on demand
        '@aws-sdk/client-s3', // Load on demand for PDF operations
      ],
    },
    
    // Development server optimization
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..'],
      },
    },
    
    // Performance optimizations
    esbuild: {
      // Tree shaking optimization
      treeShaking: true,
      // Remove unused imports
      pure: ['console.log'],
      // Target modern browsers for smaller bundles
      target: 'es2020',
    },
    
    // CSS optimization
    css: {
      // Enable CSS code splitting
      postcss: {
        plugins: [
          // Add PostCSS plugins for optimization if needed
        ],
      },
    },
    
    // Worker optimization
    worker: {
      format: 'es',
      plugins: [],
    },
  },
  
  // Astro-specific optimizations
  build: {
    // Inline CSS for critical styles
    inlineStylesheets: 'auto',
    // Split by pages for better caching
    split: true,
  },
  
  // Image optimization
  image: {
    // Enable built-in image optimization
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
  
  // Prefetch optimization
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  
  // Experimental optimizations
  experimental: {
    // Enable view transitions for better perceived performance
    viewTransitions: true,
    // Enable content collection cache
    contentCollectionCache: true,
  },
});