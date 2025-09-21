#!/usr/bin/env node

/**
 * Debug the 400 error in checkout creation
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function debugCheckoutError() {
  console.log('🐛 Debugging Stripe Checkout 400 Error...');
  console.log('=' .repeat(60));

  try {
    // 1. Test the exact configuration that's failing
    console.log('\n1️⃣ Testing Current Broken Configuration...');

    // Create a test customer first
    const testCustomer = await stripe.customers.create({
      email: 'test@example.com',
    });

    console.log(`Test customer created: ${testCustomer.id}`);

    // Try the exact same configuration from our Edge Function
    console.log('\n2️⃣ Attempting Checkout Session with Current Config...');

    try {
      const brokenSession = await stripe.checkout.sessions.create({
        customer: testCustomer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.VITE_STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
        metadata: {
          user_id: 'test-user',
        },
        // This is what I added that might be breaking it
        automatic_payment_methods: {
          enabled: false,
        },
        payment_method_configuration: undefined,
      });

      console.log('❌ Unexpected: This should have failed but didn\'t');
      console.log(`Session created: ${brokenSession.id}`);

    } catch (error) {
      console.log('✅ Found the error!');
      console.log(`Error type: ${error.type}`);
      console.log(`Error code: ${error.code}`);
      console.log(`Error message: ${error.message}`);
      console.log(`Error details:`, error.detail || 'None');
    }

    // 3. Test a working configuration
    console.log('\n3️⃣ Testing Known Working Configuration...');

    try {
      const workingSession = await stripe.checkout.sessions.create({
        customer: testCustomer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.VITE_STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
        metadata: {
          user_id: 'test-user',
        },
        // Remove the problematic configs
      });

      console.log('✅ Working configuration successful!');
      console.log(`Working session: ${workingSession.id}`);
      console.log(`URL: ${workingSession.url}`);

    } catch (error) {
      console.log('❌ Even basic config failed:');
      console.log(error.message);
    }

    // 4. Test Link disabling differently
    console.log('\n4️⃣ Testing Alternative Link Disable Methods...');

    try {
      // Method 1: No automatic payment methods at all
      const altSession1 = await stripe.checkout.sessions.create({
        customer: testCustomer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: process.env.VITE_STRIPE_PRICE_ID,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
        metadata: {
          user_id: 'test-user',
        },
        // Try this instead
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        },
      });

      console.log('✅ Alternative method 1 works');
      console.log(`Session: ${altSession1.id}`);

    } catch (error) {
      console.log('❌ Alternative method 1 failed:', error.message);
    }

    // Cleanup
    await stripe.customers.del(testCustomer.id);
    console.log('🧹 Test customer cleaned up');

    console.log('\n🎯 DIAGNOSIS SUMMARY:');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    throw error;
  }
}

// Run the debug
debugCheckoutError()
  .then(() => {
    console.log('\n✨ Debug completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Debug failed:', error);
    process.exit(1);
  });