/* Shared Supabase client + biometric helpers (used by every page) */
const SUPABASE_URL = "https://ajinnakmwdsosterrotj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Dc3PgfHhp3Cz48BE1Pb2pg_C0Q43CGX"; // publishable key: safe in frontend
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* Face ID / fingerprint via WebAuthn. It locks/unlocks the saved session on THIS device. */
const bio = {
  K: "frantech_bio",
  b64: b => btoa(String.fromCharCode(...new Uint8Array(b))),
  unb64: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
  async supported() {
    try { return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); }
    catch { return false; }
  },
  info() { try { return JSON.parse(localStorage.getItem(this.K)); } catch { return null; } },
  enabledFor(uid) { const i = this.info(); return !!i && i.uid === uid; },
  clear() { localStorage.removeItem(this.K); },
  async enable(user) {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Frantech Ajo", id: location.hostname },
      user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.email },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60000 } });
    localStorage.setItem(this.K, JSON.stringify({ uid: user.id, cid: this.b64(cred.rawId) }));
  },
  async verify() {
    const i = this.info(); if (!i) throw new Error("Biometrics not set up on this device.");
    await navigator.credentials.get({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: this.unb64(i.cid), transports: ["internal"] }],
      userVerification: "required", timeout: 60000 } });
    sessionStorage.setItem("frantech_unlocked", "1");
  }
};
