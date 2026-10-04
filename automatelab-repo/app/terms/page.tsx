import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service | AutomateLab" };

export default function TermsPage() {
  return <LegalPage title="Terms of Service">
    <h2>About these terms</h2>
    <p>These terms apply when you buy from or use AutomateLab. Nothing in them limits rights you have under the Consumer Protection Act, 2008 or the Electronic Communications and Transactions Act, 2002.</p>
    <h2>Prices and payment</h2>
    <p>All prices are in South African Rand (ZAR) and are shown before checkout. Payments are processed by Paystack. Access is granted only after the payment is verified.</p>
    <h2>Refunds</h2>
    <h3>Live courses</h3>
    <ul>
      <li>Cancel 7 or more days before your session: full refund, or move to another date.</li>
      <li>Cancel less than 7 days before, or miss the session: no refund, but you can move once to another date.</li>
      <li>If we cancel or reschedule: you choose a full refund or a new date.</li>
    </ul>
    <h3>Blueprint membership</h3>
    <ul>
      <li>Cancel anytime. Your access continues until the end of the month you&apos;ve paid for.</li>
      <li>We don&apos;t refund months already paid for, because the files are available to download straight away.</li>
    </ul>
    <h3>How to ask</h3>
    <p>Email <a href="mailto:business@massuba.com">business@massuba.com</a> with your account email. Approved refunds go back to your original payment method within 5–10 business days.</p>
    <h2>Licence</h2>
    <p>Blueprints and course materials are licensed for your own use and your clients&apos; use. You may not resell, republish or redistribute them as a template pack or library.</p>
    <h2>Your account</h2>
    <p>Keep your sign-in details secure. We may suspend accounts used for fraud, chargeback abuse or redistribution of paid content.</p>
    <h2>Disclaimer</h2>
    <p>Blueprints are provided as starting points. You are responsible for testing them, for how you configure them, and for the third-party services and API costs they use. To the extent the law allows, our liability is limited to the amount you paid us in the 12 months before a claim.</p>
    <h2>Contact</h2>
    <p>Email <a href="mailto:business@massuba.com">business@massuba.com</a> with questions, cancellations or refund requests.</p>
  </LegalPage>;
}
