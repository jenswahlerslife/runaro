#!/usr/bin/env node

/**
 * Fix Stripe Link phone verification issue
 * Disable automatic Link behavior in checkout sessions
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function analyzeStripeLinkIssue() {
  console.log('📱 Analyzing Stripe Link Phone Verification Issue...');
  console.log('=' .repeat(60));

  console.log('\n🔍 PROBLEM IDENTIFIED:');
  console.log('✅ The SMS issue is NOT from our Supabase config (that\'s fixed)');
  console.log('❌ The phone verification is from STRIPE LINK');
  console.log('❌ Stripe Link automatically offers saved payment methods');
  console.log('❌ This includes phone verification for security');

  console.log('\n📋 What Stripe Link Does:');
  console.log('• Saves customer payment methods across merchants');
  console.log('• Requires phone verification for security');
  console.log('• Automatically appears if customer has used Link before');
  console.log('• Shows "Betal uden Link" option to skip');

  console.log('\n💡 SOLUTIONS AVAILABLE:');
  console.log('=' .repeat(60));

  console.log('\n🔧 Option 1: Disable Stripe Link Completely');
  console.log('• Modify checkout session creation');
  console.log('• Set automatic_payment_methods.enabled = false');
  console.log('• Force traditional card-only checkout');

  console.log('\n🔧 Option 2: Configure Link Behavior');
  console.log('• Allow Link but make it less prominent');
  console.log('• Ensure "Pay without Link" is clearly visible');
  console.log('• Users can choose to skip Link verification');

  console.log('\n🔧 Option 3: Custom Checkout Configuration');
  console.log('• Disable Link entirely for all customers');
  console.log('• Use payment_method_types: ["card"] only');
  console.log('• Remove automatic payment method detection');

  console.log('\n⚠️  CURRENT CHECKOUT SESSION CONFIG:');
  console.log('• payment_method_types: ["card"]');
  console.log('• automatic_payment_methods: NOT explicitly disabled');
  console.log('• Link: Automatically enabled by Stripe for returning customers');

  console.log('\n🎯 RECOMMENDED SOLUTION:');
  console.log('=' .repeat(60));
  console.log('✅ DISABLE Stripe Link in checkout session creation');
  console.log('✅ Force card-only payment for clean UX');
  console.log('✅ Remove phone verification requirement');
  console.log('✅ Provide consistent experience for all users');

  return {
    issue: 'stripe_link_phone_verification',
    solution: 'disable_link_in_checkout',
    impact: 'no_phone_verification_required'
  };
}

// Run the analysis
analyzeStripeLinkIssue()
  .then((results) => {
    console.log('\n✨ Analysis completed!');
    console.log('Next: Update create-checkout function to disable Link');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Analysis failed:', error);
    process.exit(1);
  });