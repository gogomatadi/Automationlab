import { NextResponse } from "next/server";
import { paystackRequest } from "@/lib/paystack";
import { createAdminClientInstance, requireUser } from "@/lib/supabase/server";

// Buyer lands here after paying. Verifies the transaction and confirms immediately;
// the webhook is the independent backup/authority. Both call the idempotent RPC.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const user = await requireUser();
  if (!user || !reference) return NextResponse.redirect(new URL("/login?next=/account", url.origin));

  const supabase = createAdminClientInstance();
  const { data: payment } = await supabase.from("payments").select("id,user_id,status,amount_cents,currency")
    .eq("paystack_reference", reference).eq("user_id", user.id).maybeSingle();
  if (!payment) return NextResponse.redirect(new URL("/course?checkout=unknown", url.origin));
  if (payment.status === "paid") return NextResponse.redirect(new URL("/account?purchase=course", url.origin));

  const response = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
  const result = await response.json().catch(() => ({})) as { status?: boolean; data?: { status?: string; amount?: number; currency?: string } };
  const paid = result.data?.status === "success" && result.data.amount === payment.amount_cents && result.data.currency === payment.currency;
  if (!response.ok || !result.status || !paid) {
    return NextResponse.redirect(new URL("/course?checkout=failed", url.origin));
  }
  const { error } = await supabase.rpc("paystack_confirm_course_payment", {
    p_reference: reference, p_provider_payload: result.data,
  });
  if (error) return NextResponse.redirect(new URL("/course?checkout=recording-failed", url.origin));
  return NextResponse.redirect(new URL("/account?purchase=course", url.origin));
}
