#!/usr/bin/env node

/**
 * Stripe Product Setup Script for Runaro Pro Subscription
 * Creates a Pro subscription product and monthly price in Stripe
 */

import Stripe from 'stripe';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products for Runaro...');

  try {
    // 1. Create the Pro subscription product
    console.log('📦 Creating Pro subscription product...');
    const product = await stripe.products.create({
      name: 'Runaro Pro Athlete',
      description: 'Pro subscription for serious runners and large leagues',
      metadata: {
        plan: 'pro',
        app: 'runaro'
      }
    });

    console.log(`✅ Product created: ${product.id}`);

    // 2. Create the monthly price for the product
    console.log('💰 Creating monthly price (29 DKK)...');
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 2900, // 29.00 DKK in øre
      currency: 'dkk',
      recurring: {
        interval: 'month'
      },
      metadata: {
        plan: 'pro',
        app: 'runaro'
      }
    });

    console.log(`✅ Price created: ${price.id}`);

    // 3. Display results
    console.log('\n🎉 Stripe setup completed successfully!');
    console.log('\n📋 Configuration Details:');
    console.log(`Product ID: ${product.id}`);
    console.log(`Price ID: ${price.id}`);
    console.log(`Amount: ${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
    console.log(`Interval: ${price.recurring.interval}`);

    console.log('\n📝 Add this to your .env.local file:');
    console.log(`VITE_STRIPE_PRICE_ID=${price.id}`);

    console.log('\n🔗 Next steps:');
    console.log('1. Add the VITE_STRIPE_PRICE_ID to your .env.local file');
    console.log('2. Set up webhook endpoint in Stripe dashboard');
    console.log('3. Deploy Supabase Edge Functions with environment variables');
    console.log('4. Test the subscription flow');

    return { product, price };

  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error.message);
    throw error;
  }
}

// Run the setup
setupStripeProducts()
  .then(() => {
    console.log('\n✨ Setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  });

export { setupStripeProducts };