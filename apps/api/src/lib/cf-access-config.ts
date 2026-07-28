/**
 * Boot-time guard for the Cloudflare Access audience configuration.
 *
 * 2026-07-28 outage: a Doppler resync dropped the web-app aud from
 * CF_ACCESS_AUD, leaving only the API app's tag. Browser assertions carry the
 * WEB app aud, so every session exchange failed JWT verification
 * ("unexpected aud") — login silently dead while the API reported healthy.
 *
 * Portage requires BOTH Access applications' tags (web + API), comma-
 * separated. In production a missing or single-valued CF_ACCESS_AUD is a
 * guaranteed login outage, so refuse to boot instead. Dev/test run without a
 * CF edge (dev-bypass / ephemeral CI) and are exempt.
 */
export function validateCfAccessAud(raw: string | undefined, nodeEnv: string): void {
  if (nodeEnv !== 'production') return;
  const auds = (raw ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (auds.length < 2) {
    throw new Error(
      `CF_ACCESS_AUD must contain BOTH Access application audience tags (web + API, comma-separated) — got ${auds.length}. ` +
      'A single/missing aud means every browser session exchange 401s ("unexpected aud") and login is dead. ' +
      'Check Doppler CF_ACCESS_AUD against the Access apps (Portage + Portage API) and resync the env file.',
    );
  }
}
