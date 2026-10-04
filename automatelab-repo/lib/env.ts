function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const storefrontDefaults = {
  supabaseUrl: "https://jtaereoholaensttyqec.supabase.co",
  supabasePublishableKey: "sb_publishable__EFXotM1arZpHJrIwkXj2g_id_Nr72Y",
  adminEmail: "gogomatadi@gmail.com",
};

export const publicEnv = {
  supabaseUrl: () => process.env.NEXT_PUBLIC_SUPABASE_URL || storefrontDefaults.supabaseUrl,
  supabaseKey: () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || storefrontDefaults.supabasePublishableKey,
  paypalClientId: () => required("NEXT_PUBLIC_PAYPAL_CLIENT_ID"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    || "http://localhost:3000",
};

export const serverEnv = {
  supabaseSecret: () => required("SUPABASE_SECRET_KEY"),
  paypalSecret: () => required("PAYPAL_CLIENT_SECRET"),
  paypalWebhookId: () => required("PAYPAL_WEBHOOK_ID"),
  paypalEnvironment: () => process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
  paystackSecret: () => required("PAYSTACK_SECRET_KEY"),
  adminEmail: () => (process.env.ADMIN_EMAIL || storefrontDefaults.adminEmail).toLowerCase(),
  releaseBucket: () => process.env.RELEASE_BUCKET || "blueprint-releases",
};
