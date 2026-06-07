import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        d1Databases: ['DB'],
        bindings: {
          HOSTING_MODE: 'self', // テスト環境は self モード固定
        },
      },
    }),
  ],
  test: {
    isolate: false, // Windows D1 SHM file lock workaround
  },
});
