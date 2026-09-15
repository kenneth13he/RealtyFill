// app/privacy/page.tsx
// Privacy Policy. Written to describe what this app ACTUALLY does — notably
// that pasted listing text and uploaded documents are sent to Anthropic's
// API for extraction (app/api/extract-listing/route.ts), which a generic
// template would not disclose. Placeholders in components/LegalPage.tsx
// (entity name, contact email) must be filled in before launch, and this
// should be reviewed by someone qualified: it covers real client personal
// information under Canadian privacy law.

import type { Metadata } from "next";
import LegalPage, { Section, LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — RealtyFill",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information RealtyFill (&quot;we&quot;, operated by {LEGAL_ENTITY_NAME}) collects,
        why, and who it is shared with. RealtyFill is a tool for real estate agents to prepare Ontario lease
        paperwork, so much of the information handled is personal information about third parties — your clients.
      </p>

      <Section heading="Information you provide">
        <p>
          <strong>Account information.</strong> Your email address, and a password if you do not sign in with
          Google. If you sign in with Google, we receive your email address and basic profile information from
          Google; we never receive your Google password.
        </p>
        <p>
          <strong>Profile and brokerage details.</strong> Your name, phone number, and brokerage name and address,
          if you choose to save them.
        </p>
        <p>
          <strong>Deal information.</strong> Everything you enter or import for a deal — including names, phone
          numbers, and addresses of tenants, landlords, and other parties, along with rent, deposit, and lease
          terms. This is personal information about your clients, and you are responsible for having the right to
          provide it to us.
        </p>
        <p>
          <strong>Uploaded documents.</strong> Listing exports, schedules, and other files you upload, plus any text
          you paste into the app.
        </p>
      </Section>

      <Section heading="Information we generate">
        <p>
          Completed PDF forms produced from your deal information, which we store so you can download them again
          later.
        </p>
      </Section>

      <Section heading="Automated extraction and AI processing">
        <p>
          When you paste listing text or upload a document to be read automatically, that content is sent to
          Anthropic&apos;s API (the Claude model) so field values can be extracted from it. This means listing
          documents and any personal information contained in them are transmitted to and processed by Anthropic as
          part of providing that feature.
        </p>
        <p>
          This only happens for content you explicitly submit for extraction. Deal information you type in manually
          is not sent to Anthropic.
        </p>
      </Section>

      <Section heading="Service providers">
        <p>We use the following providers, and your information is stored on or passes through their systems:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Supabase</strong> — database, authentication, and file storage for your account, deals, and
            generated PDFs.
          </li>
          <li>
            <strong>Vercel</strong> — application hosting and request logs.
          </li>
          <li>
            <strong>Anthropic</strong> — automated extraction, as described above.
          </li>
          <li>
            <strong>Google</strong> — only if you choose to sign in with Google.
          </li>
        </ul>
        <p>
          These providers may store or process data outside Canada, including in the United States. We do not sell
          your information, and we do not share it with anyone else except as described here or where required by
          law.
        </p>
      </Section>

      <Section heading="How we protect it">
        <p>
          Data is encrypted in transit. Each account&apos;s deals are isolated at the database level, so one user
          cannot read or modify another user&apos;s deals. Generated PDFs are kept in private storage and are only
          accessible through short-lived links issued to the account that owns them.
        </p>
        <p>
          No system is perfectly secure. You are responsible for keeping your password confidential and for the
          security of the devices you use.
        </p>
      </Section>

      <Section heading="Retention and deletion">
        <p>
          We keep your account and deal information until you ask us to delete it. To request deletion of your
          account or any specific deal, contact us at {LEGAL_CONTACT_EMAIL} and we will action it.
        </p>
        <p>
          Self-service account deletion is not yet available in the app. Until it is, deletion requests are handled
          manually.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          Under Canadian privacy law you may request access to the personal information we hold about you, ask that
          it be corrected, or ask that it be deleted. Contact us at {LEGAL_CONTACT_EMAIL}.
        </p>
        <p>
          If your clients ask you about how their information is handled in this tool, you may share this policy
          with them.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update this policy. If we make a significant change, we will update the date at the top of this
          page.
        </p>
      </Section>

      <Section heading="Contact">
        <p>Questions about this policy: {LEGAL_CONTACT_EMAIL}</p>
      </Section>
    </LegalPage>
  );
}
