import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    isolate: false, // Windows D1 SHM file lock workaround
    poolOptions: {
      workers: {
        isolatedStorage: false, // Disable isolated storage to avoid SQLITE-SHM.tmp lock on Windows
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: ['DB'],
          bindings: {
            HOSTING_MODE: 'self', // テスト環境は self モード固定
          },
        },
      },
    },
  },
});
