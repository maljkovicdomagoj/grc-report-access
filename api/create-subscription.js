// POST /api/create-subscription  { email, firstName, lastName, priceId }
// No auth — the Supabase user does not exist yet (it's created after payment).
// Creates/reuses the Stripe customer + an incomplete subscription, returns the
// client secret to confirm on the frontend. The webhook writes the subscriptions row.
import { stripe, json, corsHeaders } from './_lib.js';

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request) {
  const cors = corsHeaders(request);
  const { email, firstName, lastName, priceId } = await request.json().catch(() => ({}));
  if (!email || !priceId) return json({ error: 'missing_fields' }, 400, cors);

  // Reuse an existing customer for this email, else create one.
  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer = existing.data[0] || await stripe.customers.create({
    email,
    name: [firstName, lastName].filter(Boolean).join(' ') || undefined
  });

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret'],
    metadata: { email }    // webhook stores this; user_id is linked later by email
  });

  const clientSecret = sub.latest_invoice?.confirmation_secret?.client_secret;
  if (!clientSecret) {
    return json({ error: 'no_client_secret',
      hint: 'account API version must expose invoice.confirmation_secret' }, 500, cors);
  }
  return json({ subscriptionId: sub.id, clientSecret }, 200, cors);
}
