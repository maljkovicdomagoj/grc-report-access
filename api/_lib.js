// Shared helpers for the /api functions.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Service-role client — bypasses RLS. Server only.
export const supabaseAdmin = createClient(
  process.env.STORAGE_SUPABASE_URL,
  process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Verify the caller's Supabase JWT (Authorization: Bearer <token>) -> user or null.
export async function getUser(request) {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error ? null : data.user;
}

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
