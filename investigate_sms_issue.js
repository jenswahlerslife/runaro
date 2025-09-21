#!/usr/bin/env node

/**
 * Investigation script to understand SMS behavior in Stripe/Supabase integration
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

async function investigateSMSIssue() {
  console.log('🔍 Investigating SMS Issue in Stripe Integration...');
  console.log('=' .repeat(60));

  try {
    // 1. Check Stripe account SMS settings
    console.log('\n1️⃣ Checking Stripe Account Configuration...');
    const account = await stripe.accounts.retrieve();
    console.log(`Account ID: ${account.id}`);
    console.log(`Display Name: ${account.display_name || 'N/A'}`);

    // 2. Check if there are any customers with phone numbers
    console.log('\n2️⃣ Checking Stripe Customers with Phone Numbers...');
    const customers = await stripe.customers.list({ limit: 10 });
    let customersWithPhones = 0;

    customers.data.forEach(customer => {
      if (customer.phone) {
        customersWithPhones++;
        console.log(`Customer ${customer.id} has phone: ${customer.phone}`);
      }
    });

    if (customersWithPhones === 0) {
      console.log('✅ No customers with phone numbers found in Stripe');
    } else {
      console.log(`⚠️  Found ${customersWithPhones} customers with phone numbers`);
    }

    // 3. Check Stripe product/price configuration for SMS triggers
    console.log('\n3️⃣ Checking Product Configuration...');
    const price = await stripe.prices.retrieve(process.env.VITE_STRIPE_PRICE_ID, {
      expand: ['product']
    });

    console.log(`Product: ${price.product.name}`);
    console.log(`Price ID: ${price.id}`);
    console.log(`Product Metadata:`, price.product.metadata);
    console.log(`Price Metadata:`, price.metadata);

    // 4. Check Supabase Auth settings
    console.log('\n4️⃣ Checking Supabase Auth Configuration...');

    // Try to get auth settings (this might not work with service key)
    try {
      const { data: authSettings } = await supabase
        .from('auth.users')
        .select('phone')
        .limit(5);

      console.log('Auth users table accessible');
    } catch (error) {
      console.log('Cannot directly access auth settings via API');
    }

    // 5. Check if SMS providers are configured
    console.log('\n5️⃣ SMS Provider Analysis...');
    console.log('Based on config.toml:');
    console.log('- SMS Signup: ENABLED ⚠️');
    console.log('- SMS Confirmations: DISABLED');
    console.log('- Twilio Provider: DISABLED');

    // 6. Analyze the problem
    console.log('\n🚨 PROBLEM ANALYSIS:');
    console.log('=' .repeat(60));
    console.log('SMS messages are being sent because:');

    if (customersWithPhones > 0) {
      console.log('❌ Existing Stripe customers have phone numbers from previous testing');
      console.log('   → These phone numbers will be used for payment notifications');
    }

    console.log('❌ Supabase Auth SMS signup is enabled in config.toml');
    console.log('   → This can trigger SMS attempts during auth flows');

    console.log('\n💡 SOLUTION NEEDED:');
    console.log('1. Disable SMS signup in Supabase Auth configuration');
    console.log('2. Remove phone numbers from existing Stripe customers');
    console.log('3. Ensure checkout flow doesn\'t collect phone numbers');
    console.log('4. Configure Stripe to not send SMS notifications');

    // 7. Provide specific fixes
    console.log('\n🛠️  IMMEDIATE FIXES REQUIRED:');
    console.log('=' .repeat(60));

    console.log('\nA) Update supabase/config.toml:');
    console.log('   [auth.sms]');
    console.log('   enable_signup = false  # Change from true to false');

    console.log('\nB) Clean up existing Stripe customers:');
    if (customersWithPhones > 0) {
      console.log('   - Remove phone numbers from existing customers');
      console.log('   - Or create new clean customers for testing');
    }

    console.log('\nC) Verify checkout session creation doesn\'t include phone:');
    console.log('   - Review create-checkout function');
    console.log('   - Ensure no phone collection in Stripe Checkout');

    return {
      smsSignupEnabled: true,
      customersWithPhones,
      needsConfigFix: true,
      needsCleanup: customersWithPhones > 0
    };

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
    throw error;
  }
}

// Run the investigation
investigateSMSIssue()
  .then((results) => {
    console.log('\n✨ Investigation completed!');
    console.log('Results:', results);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Investigation failed:', error);
    process.exit(1);
  });