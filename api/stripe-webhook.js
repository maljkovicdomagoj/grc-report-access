// POST /api/stripe-webhook — the ONLY writer of the subscriptions table.
// Uses the raw request body for signature verification (Web handler -> request.text()).
import { stripe, supabaseAdmin } from './_lib.js';

function subToRow(sub) {
  // current_period_end moved to the item level in newer API versions — read both.
  const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  return {
    id: sub.id,
    user_id: sub.metadata?.user_id ?? null,
    status: sub.status,
    price_id: sub.items?.data?.[0]?.price?.id ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end
  };
}

export default async function handler(request) {
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
      await supabaseAdmin.from('subscriptions').upsert(subToRow(event.data.object));
      break;
    case 'invoice.payment_failed': {
      const inv = event.data.object;
      if (inv.subscription) {
        const sub = await stripe.subscriptions.retrieve(inv.subscription);
        await supabaseAdmin.from('subscriptions').upsert(subToRow(sub));
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }),
    { status: 200, headers: { 'content-type': 'application/json' } });
}
