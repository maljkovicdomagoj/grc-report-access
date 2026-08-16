// POST /api/create-subscription  { priceId }  (Authorization: Bearer <supabase jwt>)
// Creates an incomplete subscription and returns the client secret to confirm on
// the frontend. The webhook is what actually writes to the subscriptions table.
import { stripe, supabaseAdmin, getUser, json } from './_lib.js';

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getUser(request);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { priceId } = await request.json().catch(() => ({}));
  if (!priceId) return json({ error: 'missing_priceId' }, 400);

  // Reuse the customer stored on the profile, or create one and cache it.
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { user_id: user.id }
    });
    customerId = customer.id;
    await supabaseAdmin.from('profiles')
      .update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret'],
    metadata: { user_id: user.id }   // webhook links the subscription back to the user
  });

  const clientSecret = sub.latest_invoice?.confirmation_secret?.client_secret;
  if (!clientSecret) {
    return json({ error: 'no_client_secret',
      hint: 'account API version must expose invoice.confirmation_secret' }, 500);
  }
  return json({ subscriptionId: sub.id, clientSecret });
}
