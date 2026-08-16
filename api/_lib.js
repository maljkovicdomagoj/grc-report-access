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

// The frontend lives on the Webflow domain; the API on Vercel. Allow those origins.
const ALLOWED_ORIGINS = [
  'https://grc-report-v-1.webflow.io',
  'https://grcreport.com',
  'https://www.grcreport.com'
];
export function corsHeaders(request) {
  const origin = request.headers.get('origin');
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type'
  };
}

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });
