#!/usr/bin/env tsx

/**
 * Deploy Email Templates to Supabase Production
 *
 * This script uploads compiled email templates to your Supabase project
 * using the Management API.
 *
 * Required environment variables:
 * - SUPABASE_PROJECT_REF: Your project reference ID (from project URL)
 * - SUPABASE_ACCESS_TOKEN: Personal access token from Supabase dashboard
 *
 * Usage:
 *   tsx scripts/deploy-email-templates.ts
 *   or
 *   npm run email:deploy
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

// Types
interface TemplateConfig {
  key: string;
  subject: string;
}

interface EmailTemplate {
  content: string;
  subject: string;
}

interface AuthConfig {
  [key: string]: EmailTemplate;
}

// Configuration
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const TEMPLATES_DIR = path.join(__dirname, '../supabase/templates/auth');

// Template mapping: filename -> Supabase auth config key
const TEMPLATE_MAPPING: Record<string, TemplateConfig> = {
  'confirm-signup.html': {
    key: 'MAILER_TEMPLATES_CONFIRMATION',
    subject: 'Welcome to VolleyStats! 🏐',
  },
  'invite.html': {
    key: 'MAILER_TEMPLATES_INVITE',
    subject: "You've been invited to VolleyStats! 🏐",
  },
  'magic-link.html': {
    key: 'MAILER_TEMPLATES_MAGIC_LINK',
    subject: 'Your VolleyStats sign-in link 🏐',
  },
  'change-email.html': {
    key: 'MAILER_TEMPLATES_CHANGE_EMAIL',
    subject: 'Confirm your new email address',
  },
  'reset-password.html': {
    key: 'MAILER_TEMPLATES_RECOVERY',
    subject: 'Reset your VolleyStats password',
  },
};

// Validation
function validateEnvironment(): void {
  if (!SUPABASE_PROJECT_REF) {
    console.error('❌ Error: SUPABASE_PROJECT_REF environment variable is required');
    console.error('   Get it from your Supabase project URL: https://supabase.com/dashboard/project/{PROJECT_REF}');
    process.exit(1);
  }

  if (!SUPABASE_ACCESS_TOKEN) {
    console.error('❌ Error: SUPABASE_ACCESS_TOKEN environment variable is required');
    console.error('   Generate one at: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`❌ Error: Templates directory not found: ${TEMPLATES_DIR}`);
    console.error('   Run "npm run email:build" first to generate templates');
    process.exit(1);
  }
}

// Read template file
function readTemplate(filename: string): string {
  const filePath = path.join(TEMPLATES_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Template file not found: ${filename}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

// Update auth config via Management API
async function updateAuthConfig(config: AuthConfig): Promise<void> {
  const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed (${response.status}): ${error}`);
  }

  await response.json();
}

// Main deployment function
async function deployTemplates(): Promise<void> {
  console.log('🚀 Deploying email templates to Supabase...\n');

  validateEnvironment();

  const config: AuthConfig = {};
  let successCount = 0;
  let errorCount = 0;

  // Read all templates
  for (const [filename, templateConfig] of Object.entries(TEMPLATE_MAPPING)) {
    try {
      console.log(`📄 Reading ${filename}...`);
      const content = readTemplate(filename);

      config[templateConfig.key] = {
        content,
        subject: templateConfig.subject,
      };

      successCount++;
      console.log(`   ✅ ${filename} loaded`);
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Failed to read ${filename}: ${errorMessage}`);
    }
  }

  if (errorCount > 0) {
    console.error(`\n❌ Failed to read ${errorCount} template(s). Aborting deployment.`);
    process.exit(1);
  }

  // Upload to Supabase
  try {
    console.log(`\n📤 Uploading ${successCount} templates to Supabase...`);
    await updateAuthConfig(config);

    console.log('\n✅ Successfully deployed all email templates!');
    console.log(`   Project: ${SUPABASE_PROJECT_REF}`);
    console.log(`   Templates: ${successCount} updated\n`);
    console.log('💡 Templates are now live in production.');
    console.log('   Test them by triggering auth flows (sign up, password reset, etc.)\n');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Deployment failed:', errorMessage);
    console.error('\nTroubleshooting:');
    console.error('  1. Verify SUPABASE_ACCESS_TOKEN is valid');
    console.error('  2. Check token has project update permissions');
    console.error('  3. Verify SUPABASE_PROJECT_REF is correct');
    console.error('  4. Check Supabase API status: https://status.supabase.com\n');
    process.exit(1);
  }
}

// Run deployment
deployTemplates().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
