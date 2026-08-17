// POST /api/stripe-webhook — the ONLY writer of the subscriptions table.
// Writes email + stripe_customer_id always; links user_id by email when a
// matching profile already exists (otherwise the new-user trigger links it later).
// Uses the raw request body for signature verification (Web handler -> request.text()).
import { stripe, supabaseAdmin } from './_lib.js';

async function subToRow(sub) {
  const email = sub.metadata?.email ?? null;
  let userId = null;
  if (email) {
    const { data } = await supabaseAdmin
      .from('profiles').select('id').eq('email', email).maybeSingle();
    userId = data?.id ?? null;
  }
  // current_period_end moved to the item level in newer API versions — read both.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return {
    id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    email,
    user_id: userId,
    status: sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end
  };
}

export async function POST(request) {
  const raw = await request.text();
  const sig = request.headers.get('stripe-signature');
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response('Webhook Error: ' + err.message, { status: 400 });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await supabaseAdmin.from('subscriptions').upsert(await subToRow(event.data.object));
      break;
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(inv.subscription);
        await supabaseAdmin.from('subscriptions').upsert(await subToRow(sub));
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }),
    { status: 200, headers: { 'content-type': 'application/json' } });
}
