// prisma/env.js
  const { config } = require('dotenv');

  // Load .env.local first, then .env as fallback
  config({ path: '.env.local' });
  config({ path: '.env' });

  //Then modify your package.json scripts to use this configuration:
