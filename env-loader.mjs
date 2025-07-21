// Environment loader for Astro development
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first, then .env as fallback
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

console.log('✅ Environment variables loaded from .env.local');