#!/usr/bin/env node

/**
 * Find the correct way to disable Stripe Link
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function findCorrectLinkDisable() {
  console.log('🔍 Finding Correct Way to Disable Stripe Link...');
  console.log('=' .repeat(60));

  try {
    // Create test customer
    const testCustomer = await stripe.customers.create({
      email: 'test@example.com',
    });

    console.log('\n🧪 Testing Different Link Disable Methods...');

    // Method 1: Customer creation if required (don't pre-create customer)
    console.log('\n1️⃣ Method 1: customer_creation = "if_required"');
    try {
      const session1 = await stripe.checkout.sessions.create({
        customer_creation: 'if_required', // Don't pre-create customer
        customer_email: 'test@example.com',
        payment_method_types: ['card'],
        line_items: [{ price: process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
      });
      console.log('✅ Method 1 works:', session1.id);
    } catch (error) {
      console.log('❌ Method 1 failed:', error.message);
    }

    // Method 2: Use payment_method_options
    console.log('\n2️⃣ Method 2: payment_method_options');
    try {
      const session2 = await stripe.checkout.sessions.create({
        customer: testCustomer.id,
        payment_method_types: ['card'],
        payment_method_options: {
          card: {
            setup_future_usage: 'off_session',
          },
        },
        line_items: [{ price: process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
      });
      console.log('✅ Method 2 works:', session2.id);
    } catch (error) {
      console.log('❌ Method 2 failed:', error.message);
    }

    // Method 3: Check current Stripe API version and available options
    console.log('\n3️⃣ Method 3: Check available parameters');
    console.log('Current Stripe API version:', stripe.VERSION);

    // Method 4: Simplest - just use payment_method_types only
    console.log('\n4️⃣ Method 4: Basic card-only (what we have now)');
    try {
      const session4 = await stripe.checkout.sessions.create({
        customer: testCustomer.id,
        payment_method_types: ['card'],
        line_items: [{ price: process.env.VITE_STRIPE_PRICE_ID, quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://runaro.dk/subscription?success=true',
        cancel_url: 'https://runaro.dk/subscription',
      });
      console.log('✅ Method 4 works:', session4.id);
      console.log('URL to test:', session4.url);
    } catch (error) {
      console.log('❌ Method 4 failed:', error.message);
    }

    // Clean up
    await stripe.customers.del(testCustomer.id);

    console.log('\n💡 ANALYSIS:');
    console.log('=' .repeat(60));
    console.log('The issue might not be the Stripe configuration, but:');
    console.log('1. Your browser has saved Link credentials');
    console.log('2. Stripe detects you as a returning Link user');
    console.log('3. Link appears regardless of our configuration');
    console.log('');
    console.log('🎯 SOLUTIONS:');
    console.log('1. Test in incognito/private browser');
    console.log('2. Use customer_creation = "if_required" method');
    console.log('3. Clear browser data for Stripe');
    console.log('4. Test with a different email address');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
findCorrectLinkDisable()
  .then(() => {
    console.log('\n✨ Investigation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Investigation failed:', error);
    process.exit(1);
  });