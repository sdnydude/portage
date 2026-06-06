export const dynamic = "force-dynamic";

/**
 * Reports the git SHA the running container was built from. Baked at image
 * build time via the GIT_SHA build arg (see apps/web/Dockerfile + compose).
 * Used by the frontend-e2e enforcement hook to detect a stale container
 * before allowing a push.
 */
export function GET() {
  return Response.json({ sha: process.env.GIT_SHA ?? "unknown" });
}
