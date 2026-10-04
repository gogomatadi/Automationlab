import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service | AutomateLab" };

export default function TermsPage() {
  return <LegalPage title="Terms of Service">
    <h2>About these terms</h2>
    <p>These terms apply when you buy from or use AutomateLab. Nothing in them limits rights you have under the Consumer Protection Act, 2008 or the Electronic Communications and Transactions Act, 2002.</p>
    <h2>Prices and payment</h2>
    <p>All prices are in South African Rand (ZAR) and are shown before checkout. Payments are processed by Paystack. Access is granted only after the payment is verified.</p>
    <h2>Blueprint membership</h2>
    <p>The membership is billed monthly until you cancel. You can cancel at any time and keep access until the end of the period you have paid for. Files you have already downloaded remain yours to use in your own business or for your clients.</p>
    <h2>Live courses</h2>
    <p>Each session has limited seats, and your seat is confirmed once payment is verified. If we cancel or reschedule a session, you may choose a different date or receive a full refund. If you cannot attend, contact us at least 7 days before the session to move to another date or get a refund.</p>
    <h2>Licence</h2>
    <p>Blueprints and course materials are licensed for your own use and your clients&apos; use. You may not resell, republish or redistribute them as a template pack or library.</p>
    <h2>Your account</h2>
    <p>Keep your sign-in details secure. We may suspend accounts used for fraud, chargeback abuse or redistribution of paid content.</p>
    <h2>Disclaimer</h2>
    <p>Blueprints are provided as starting points. You are responsible for testing them, for how you configure them, and for the third-party services and API costs they use. To the extent the law allows, our liability is limited to the amount you paid us in the 12 months before a claim.</p>
    <h2>Contact</h2>
    <p>Email <a href="mailto:gogomatadi@gmail.com">gogomatadi@gmail.com</a> with questions, cancellations or refund requests.</p>
  </LegalPage>;
}
