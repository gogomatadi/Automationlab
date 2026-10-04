import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy | AutomateLab" };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy">
    <h2>Who we are</h2>
    <p>AutomateLab sells Make.com automation blueprints and live automation courses. We are the responsible party for the personal information described here, which we process in line with the Protection of Personal Information Act, 2013 (POPIA).</p>
    <h2>What we collect</h2>
    <p>Your email address and sign-in details when you create an account or sign in with Google; your purchases, course registrations and membership status; and the payment reference and status returned by our payment provider. We do not receive or store your card details.</p>
    <h2>Why we use it</h2>
    <p>To create and secure your account, process payments, grant access to downloads and courses you have paid for, send you course and account information, and meet our legal and tax obligations.</p>
    <h2>Who we share it with</h2>
    <p>Only the service providers needed to run the store: Paystack (payments), Supabase (accounts and data storage), Vercel (hosting) and Google (if you choose Google sign-in). Some of these providers process data outside South Africa under their own safeguards. We do not sell your personal information.</p>
    <h2>How long we keep it</h2>
    <p>For as long as your account is active, and afterwards only as long as required for tax, accounting or dispute purposes.</p>
    <h2>Your rights</h2>
    <p>You may ask to access, correct or delete your personal information, or object to its processing, by contacting us. You may also lodge a complaint with the Information Regulator of South Africa.</p>
    <h2>Cookies</h2>
    <p>We use only the cookies needed to keep you signed in and to complete checkout. We do not use advertising cookies.</p>
    <h2>Contact</h2>
    <p>Email <a href="mailto:gogomatadi@gmail.com">gogomatadi@gmail.com</a> with any privacy request.</p>
  </LegalPage>;
}
