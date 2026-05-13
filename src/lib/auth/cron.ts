import { OAuth2Client } from "google-auth-library";

const oauthClient = new OAuth2Client();

/**
 * Verify a Cloud Scheduler OIDC token sent in the Authorization header.
 *
 * Cloud Scheduler signs the token with the deployer SA's identity and
 * sets `aud` to the configured audience (the Cloud Run service URL).
 * Returns the verified payload, or null when the header is missing.
 *
 * Throws when the token is present but invalid — the caller should
 * translate that into a 401 response.
 */
export async function verifyCronOidc(
  authHeader: string | null,
  expectedAudience: string,
): Promise<{ email?: string; sub?: string } | null> {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;
  const idToken = match[1];

  // Fallback: legacy CRON_SECRET shared secret. Only honored if the
  // value matches verbatim — not a JWT-style token.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && idToken === cronSecret) {
    return { sub: "legacy-cron-secret" };
  }

  // Accept either the request-derived audience or an explicit
  // CRON_AUDIENCE env (set when behind a domain mapping / load balancer).
  const audiences = [expectedAudience];
  if (process.env.CRON_AUDIENCE) audiences.push(process.env.CRON_AUDIENCE);

  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: audiences,
  });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error("OIDC token has no payload");
  }
  return { email: payload.email, sub: payload.sub };
}
