#!/usr/bin/env node

/**
 * create-mailtrack — FR-P2-20
 * npx create-mailtrack@latest でセルフホスト版を簡単セットアップ。
 *
 * 手順:
 * 1. git clone
 * 2. pnpm install
 * 3. wrangler login (対話的)
 * 4. D1 作成 + マイグレーション
 * 5. self テナント投入
 * 6. wrangler deploy
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const REPO = 'https://github.com/dkamehat/mailtrack-pf.git';
const DIR = 'mailtrack-pf';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log('\n📬 mailtrack-pf Setup Wizard\n');
  console.log('This will set up your own email tracking instance on Cloudflare.\n');

  // Step 1: Clone
  if (existsSync(DIR)) {
    console.log(`✓ ${DIR}/ already exists, skipping clone.`);
  } else {
    console.log('Cloning repository...');
    run(`git clone --depth 1 ${REPO}`);
  }
  process.chdir(DIR);

  // Step 2: Install
  console.log('\nInstalling dependencies...');
  run('pnpm install');

  // Step 3: Wrangler login
  console.log('\n🔑 Cloudflare login required.');
  console.log('A browser window will open for authentication.\n');
  await ask('Press Enter to continue...');
  run('npx wrangler login');

  // Step 4: Create D1
  const dbName = (await ask('\nD1 database name [mailtrack-pf-db]: ')).trim() || 'mailtrack-pf-db';
  console.log(`\nCreating D1 database "${dbName}"...`);
  try {
    const output = run(`npx wrangler d1 create ${dbName}`, true);
    const match = output.match(/database_id\s*=\s*"([^"]+)"/);
    if (match) {
      console.log(`✓ Database ID: ${match[1]}`);
      console.log('\n⚠️  Update apps/api/wrangler.toml with this database_id.');
    }
  } catch {
    console.log('Database may already exist, continuing...');
  }

  // Step 5: Migrations
  console.log('\nApplying migrations...');
  const migrations = ['0000_peaceful_apocalypse.sql', '0001_better_auth_tables.sql'];
  for (const m of migrations) {
    const path = join('packages', 'db', 'migrations', m);
    if (existsSync(path)) {
      try {
        run(`npx wrangler d1 execute ${dbName} --local --file=${path} --config=apps/api/wrangler.toml`);
        console.log(`  ✓ ${m}`);
      } catch {
        console.log(`  ⚠ ${m} (may already be applied)`);
      }
    }
  }

  // Step 6: Seed
  console.log('\nSeeding self tenant...');
  try {
    run(`npx wrangler d1 execute ${dbName} --local --config=apps/api/wrangler.toml --command="INSERT OR IGNORE INTO tenants (id, name, plan, monthly_email_limit, reset_at) VALUES ('self', 'Self', 'self', 100000, unixepoch() + 2592000); INSERT OR IGNORE INTO users (id, tenant_id, email, name) VALUES ('self', 'self', 'self@localhost', 'Self User');"`);
    console.log('  ✓ Self tenant created');
  } catch {
    console.log('  ⚠ Seed may already exist');
  }

  console.log('\n✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Update apps/api/wrangler.toml with your database_id');
  console.log('  2. Run: pnpm dev');
  console.log('  3. Open: http://localhost:8787/health');
  console.log('  4. Install Chrome extension: chrome://extensions → Load unpacked → apps/extension/');
  console.log('\nTo deploy to production:');
  console.log('  npx wrangler deploy --config=apps/api/wrangler.toml\n');

  rl.close();
}

function run(cmd, capture = false) {
  if (capture) {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['inherit', 'pipe', 'pipe'] });
  }
  execSync(cmd, { stdio: 'inherit' });
  return '';
}

main().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
