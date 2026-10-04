import { release } from "@/lib/release";

export async function GET() {
  return Response.json({
    ...release,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
