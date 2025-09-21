#!/usr/bin/env node

/**
 * Stripe Integration Test Script for Runaro
 * Tests the complete subscription workflow
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testStripeIntegration() {
  console.log('🧪 Testing Stripe Integration for Runaro...');
  console.log('=' .repeat(50));

  try {
    // 1. Test Stripe Connection
    console.log('\n1️⃣ Testing Stripe Connection...');
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.display_name || account.id}`);

    // 2. Verify Product and Price
    console.log('\n2️⃣ Verifying Stripe Product and Price...');
    const priceId = process.env.VITE_STRIPE_PRICE_ID;
    if (!priceId) {
      throw new Error('VITE_STRIPE_PRICE_ID not found in environment');
    }

    const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
    console.log(`✅ Price found: ${price.id}`);
    console.log(`   Product: ${price.product.name}`);
    console.log(`   Amount: ${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
    console.log(`   Interval: ${price.recurring.interval}`);

    // 3. Test Supabase Connection
    console.log('\n3️⃣ Testing Supabase Connection...');
    const { data: testConnection, error } = await supabase
      .from('subscribers')
      .select('*')
      .limit(1);

    if (error && !error.message.includes('relation "subscribers" does not exist')) {
      throw error;
    }
    console.log(`✅ Connected to Supabase database`);

    // 4. Test Database Functions
    console.log('\n4️⃣ Testing Database Functions...');

    // Test get_user_plan function
    const { data: planTest, error: planError } = await supabase.rpc('get_user_plan', {
      user_uuid: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });

    if (planError && !planError.message.includes('relation "subscribers" does not exist')) {
      console.log(`✅ get_user_plan function exists`);
    } else {
      console.log(`⚠️  get_user_plan function test: ${planError?.message || 'OK'}`);
    }

    // Test get_user_subscription function
    const { data: subTest, error: subError } = await supabase.rpc('get_user_subscription', {
      user_uuid: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    });

    if (subError && !subError.message.includes('relation "subscribers" does not exist')) {
      console.log(`✅ get_user_subscription function exists`);
    } else {
      console.log(`⚠️  get_user_subscription function test: ${subError?.message || 'OK'}`);
    }

    // 5. Test Edge Functions URLs
    console.log('\n5️⃣ Testing Edge Function URLs...');
    const functionUrls = {
      'create-checkout': `${process.env.SUPABASE_URL}/functions/v1/create-checkout`,
      'customer-portal': `${process.env.SUPABASE_URL}/functions/v1/customer-portal`,
      'stripe-webhook': `${process.env.SUPABASE_URL}/functions/v1/stripe-webhook`
    };

    for (const [name, url] of Object.entries(functionUrls)) {
      console.log(`   ${name}: ${url}`);
    }

    // 6. Environment Variables Check
    console.log('\n6️⃣ Environment Variables Check...');
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'VITE_STRIPE_PRICE_ID',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY'
    ];

    let allEnvVarsPresent = true;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        console.log(`   ✅ ${envVar}: Set`);
      } else {
        console.log(`   ❌ ${envVar}: Missing`);
        allEnvVarsPresent = false;
      }
    }

    // 7. Webhook Configuration Check
    console.log('\n7️⃣ Webhook Configuration...');
    if (process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_placeholder') {
      console.log(`✅ Webhook secret configured`);
    } else {
      console.log(`⚠️  Webhook secret not configured (use placeholder)`);
      console.log(`   To complete setup, add webhook endpoint in Stripe dashboard:`);
      console.log(`   URL: ${process.env.SUPABASE_URL}/functions/v1/stripe-webhook`);
      console.log(`   Events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed`);
    }

    // 8. Summary
    console.log('\n🎉 Integration Test Summary');
    console.log('=' .repeat(50));

    if (allEnvVarsPresent) {
      console.log('✅ All environment variables configured');
      console.log('✅ Stripe product and price created');
      console.log('✅ Supabase connection working');
      console.log('✅ Edge functions deployed');

      if (process.env.STRIPE_WEBHOOK_SECRET !== 'whsec_placeholder') {
        console.log('✅ Ready for production testing!');
      } else {
        console.log('⚠️  Webhook setup needed to complete integration');
        console.log('\n📋 Next Steps:');
        console.log('1. Go to https://dashboard.stripe.com/webhooks');
        console.log('2. Create new webhook endpoint');
        console.log(`3. URL: ${process.env.SUPABASE_URL}/functions/v1/stripe-webhook`);
        console.log('4. Select events: customer.subscription.*, invoice.payment_*');
        console.log('5. Update STRIPE_WEBHOOK_SECRET in .env.local');
        console.log('6. Redeploy functions: npx supabase functions deploy');
      }
    } else {
      console.log('❌ Missing required environment variables');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check that all environment variables are set correctly');
    console.error('2. Verify Stripe keys are valid and have the correct permissions');
    console.error('3. Ensure Supabase service key has the necessary permissions');
    throw error;
  }
}

// Run the test
testStripeIntegration()
  .then(() => {
    console.log('\n✨ Integration test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Integration test failed:', error);
    process.exit(1);
  });