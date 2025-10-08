import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.9.0?target=deno'

const cryptoProvider = Stripe.createSubtleCryptoProvider()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('Stripe-Signature')
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (!signature || !endpointSecret || !stripeKey) {
    return new Response('Webhook secret not found', { status: 400 })
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2022-11-15',
    cryptoProvider,
  })

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      endpointSecret,
      undefined,
      cryptoProvider
    )

    console.log(`🔔 Webhook received: ${event.type}`)

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabaseClient, subscription)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCancellation(supabaseClient, subscription)
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
          await handleSubscriptionUpdate(supabaseClient, subscription)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log(`❌ Payment failed for customer: ${invoice.customer}`)
        // Could implement grace period logic here
        break
      }
      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error(`❌ Error processing webhook: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, {
      status: 400,
    })
  }
})

async function handleSubscriptionUpdate(
  supabaseClient: any,
  subscription: Stripe.Subscription
) {
  try {
    const customerId = subscription.customer as string
    const status = subscription.status
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000)
    
    // Determine subscription tier based on price
    const priceId = subscription.items.data[0]?.price.id
    const subscriptionTier = priceId === Deno.env.get('STRIPE_PRICE_ID') ? 'pro' : 'free'
    
    const isActive = ['active', 'trialing'].includes(status)

    console.log(`📝 Updating subscription for customer: ${customerId}`)
    console.log(`Status: ${status}, Tier: ${subscriptionTier}, Active: ${isActive}`)

    const { error } = await supabaseClient
      .from('subscribers')
      .update({
        subscribed: isActive,
        subscription_tier: isActive ? subscriptionTier : 'free',
        subscription_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('❌ Error updating subscription:', error)
      throw error
    }

    console.log('✅ Subscription updated successfully')
  } catch (error) {
    console.error('❌ Error in handleSubscriptionUpdate:', error)
    throw error
  }
}

async function handleSubscriptionCancellation(
  supabaseClient: any,
  subscription: Stripe.Subscription
) {
  try {
    const customerId = subscription.customer as string
    
    console.log(`❌ Cancelling subscription for customer: ${customerId}`)

    const { error } = await supabaseClient
      .from('subscribers')
      .update({
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('❌ Error cancelling subscription:', error)
      throw error
    }

    console.log('✅ Subscription cancelled successfully')
  } catch (error) {
    console.error('❌ Error in handleSubscriptionCancellation:', error)
    throw error
  }
}