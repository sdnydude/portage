import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from './env.js';

export interface CfIdentity {
  email: string | null;
  commonName: string | null;
}

// Cached remote JWKS — jose handles key rotation + refetching internally.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function teamDomainBase(): string {
  return `https://${env().CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com`;
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomainBase()}/cdn-cgi/access/certs`));
  }
  return jwks;
}

/**
 * Verify a Cf-Access-Jwt-Assertion header value against the Cloudflare Access
 * team JWKS. Returns the authenticated identity: `email` for interactive IdP
 * logins, `commonName` for service-token requests.
 */
export async function verifyCfAccessJwt(token: string): Promise<CfIdentity> {
  const audienceRaw = env().CF_ACCESS_AUD;
  if (!audienceRaw) {
    throw new Error('CF_ACCESS_AUD is not configured');
  }
  // Comma-separated: the web app and API Access applications carry different
  // audience tags; a token matching any configured aud is accepted.
  const audience = audienceRaw.split(',').map((a) => a.trim()).filter(Boolean);

  const { payload } = await jwtVerify(token, getJwks(), {
    issuer: teamDomainBase(),
    audience,
  });

  return {
    email: typeof payload.email === 'string' ? payload.email : null,
    commonName: typeof payload.common_name === 'string' ? payload.common_name : null,
  };
}
