"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { paypalRequest } from "@/lib/paypal";
import { createClient, requireAdmin } from "@/lib/supabase/server";

async function adminClient() {
  if (!await requireAdmin()) redirect("/login?next=/admin/paypal");
  return createClient();
}

export async function initializePayPalSubscription() {
  const supabase = await adminClient();
  const { data: settings } = await supabase.from("storefront_settings").select("key,value")
    .in("key", ["paypal_membership_product_id", "paypal_membership_plan_id"]);
  const values = new Map(settings?.map((item) => [item.key, item.value]) || []);

  let productId = values.get("paypal_membership_product_id");
  if (!productId) {
    const productResponse = await paypalRequest("/v1/catalogs/products", {
      method: "POST",
      headers: { "PayPal-Request-Id": "automatelab-membership-product-v1" },
      body: JSON.stringify({
        name: "AutomateLab Blueprint Membership",
        description: "Monthly access to the AutomateLab automation blueprint library.",
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    const product = await productResponse.json() as { id?: string };
    if (!productResponse.ok || !product.id) redirect("/admin/paypal?error=product");
    productId = product.id;
    const { error } = await supabase.from("storefront_settings").upsert({
      key: "paypal_membership_product_id",
      value: productId,
      updated_at: new Date().toISOString(),
    });
    if (error) redirect("/admin/paypal?error=save");
  }

  if (!values.get("paypal_membership_plan_id")) {
    const planResponse = await paypalRequest("/v1/billing/plans", {
      method: "POST",
      headers: { "PayPal-Request-Id": "automatelab-membership-plan-usd-999-v1", Prefer: "return=representation" },
      body: JSON.stringify({
        product_id: productId,
        name: "AutomateLab Blueprint Membership — $9.99 monthly",
        description: "Monthly access to current and future AutomateLab blueprint releases.",
        status: "ACTIVE",
        billing_cycles: [{
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: "9.99", currency_code: "USD" } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: "0", currency_code: "USD" },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
      }),
    });
    const plan = await planResponse.json() as { id?: string };
    if (!planResponse.ok || !plan.id) redirect("/admin/paypal?error=plan");
    const { error } = await supabase.from("storefront_settings").upsert({
      key: "paypal_membership_plan_id",
      value: plan.id,
      updated_at: new Date().toISOString(),
    });
    if (error) redirect("/admin/paypal?error=save");
  }

  revalidatePath("/admin/paypal");
  redirect("/admin/paypal?setup=created");
}
