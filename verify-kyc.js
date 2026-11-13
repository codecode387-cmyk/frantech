/* Vercel serverless function: POST /api/verify-kyc
   Runs on the server so your secret keys never reach the browser.
   Env vars (Vercel → Settings → Environment Variables):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, KYC_PEPPER (any long random string)
     DOJAH_SECRET_KEY, DOJAH_APP_ID      -> real verification with Dojah
     KYC_DEMO=true                       -> TEST ONLY: auto-approve when no provider keys are set */
const crypto = require('crypto');

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);

module.exports = async (req, res) => {
  const out = (code, status, message) => res.status(code).json({ status, message });
  if (req.method !== 'POST') return out(405, 'error', 'Method not allowed');
  if (!SUPA || !SRK || !process.env.KYC_PEPPER) return out(500, 'error', 'Server is not configured yet.');

  // 1. Who is calling? (validate the user's Supabase token)
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ur = await fetch(SUPA + '/auth/v1/user', { headers: { apikey: SRK, Authorization: 'Bearer ' + token } });
  if (!ur.ok) return out(401, 'error', 'Please log in again.');
  const user = await ur.json();

  // 2. Validate input
  const { type, number } = req.body || {};
  if (!['nin', 'bvn'].includes(type) || !/^\d{11}$/.test(String(number || ''))) return out(400, 'error', 'Enter a valid 11-digit number.');

  // 3. Load profile
  const pr = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=full_name,kyc_status`, { headers: sbHeaders });
  const prof = (await pr.json())[0];
  if (!prof) return out(400, 'error', 'Profile not found. Run the SQL setup first.');
  if (prof.kyc_status === 'verified') return out(200, 'verified', 'Already verified.');

  // 4. One ID can only belong to one account (HMAC, so the number itself is never stored)
  const hash = crypto.createHmac('sha256', process.env.KYC_PEPPER).update(type + ':' + number).digest('hex');
  const dup = await fetch(`${SUPA}/rest/v1/profiles?kyc_hash=eq.${hash}&id=neq.${user.id}&select=id`, { headers: sbHeaders });
  if ((await dup.json()).length) return out(409, 'rejected', 'This ID is already linked to another account.');

  // 5. Verify
  let status = 'pending', note = 'Waiting for review.';
  if (process.env.DOJAH_SECRET_KEY && process.env.DOJAH_APP_ID) {
    const path = type === 'nin' ? '/api/v1/kyc/nin?nin=' : '/api/v1/kyc/bvn?bvn=';   // confirm BVN path in Dojah docs
    const r = await fetch('https://api.dojah.io' + path + number, {
      headers: { Authorization: process.env.DOJAH_SECRET_KEY, AppId: process.env.DOJAH_APP_ID }  // no "Bearer"
    });
    if (r.status === 404) return out(422, 'rejected', 'No record found for that number. Check it and try again.');
    if (!r.ok) return out(502, 'error', 'The verification service is busy. Try again shortly.');
    const e = (await r.json()).entity || {};
    const idNames = new Set(norm([e.first_name, e.middle_name, e.last_name].join(' ')));
    const mine = norm(prof.full_name);
    const hits = mine.filter(w => idNames.has(w)).length;
    if (hits >= Math.min(2, mine.length) && hits > 0) { status = 'verified'; note = 'Verified'; }
    else return out(422, 'rejected', 'The name on this ID does not match your account name.');
  } else if (process.env.KYC_DEMO === 'true') {
    status = 'verified'; note = 'Demo approval (no provider connected)';
  }

  // 6. Save result (only the server can do this; users cannot edit KYC columns)
  const up = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}`, {
    method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ kyc_status: status, kyc_type: type, kyc_last4: number.slice(-4), kyc_hash: hash, kyc_note: note,
      kyc_verified_at: status === 'verified' ? new Date().toISOString() : null })
  });
  if (!up.ok) return out(500, 'error', 'Could not save your verification. Try again.');
  return out(200, status, status === 'verified' ? 'Verified' : 'Submitted for review');
};
