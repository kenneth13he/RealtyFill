// app/terms/page.tsx
// Terms of Service. The clauses that actually matter for this product are
// the ones about it not being legal advice, the user being responsible for
// reviewing generated forms, and signature fields never being auto-filled
// (a real product boundary enforced in lib/profileMapper.ts). Placeholders
// in components/LegalPage.tsx must be filled in, and this should be
// reviewed by someone qualified before real deals run through it.

import type { Metadata } from "next";
import LegalPage, { Section, LEGAL_CONTACT_EMAIL, LEGAL_ENTITY_NAME } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — RealtyFill",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of RealtyFill (&quot;the Service&quot;), operated by {LEGAL_ENTITY_NAME}. By
        creating an account or using the Service, you agree to them.
      </p>

      <Section heading="What the Service does">
        <p>
          RealtyFill lets you enter the details of a residential lease deal once and generate draft Ontario lease
          paperwork from those details. It fills form fields with information you provide or approve. It does not
          create, negotiate, or complete any transaction on your behalf.
        </p>
      </Section>

      <Section heading="Not legal advice">
        <p>
          RealtyFill is a document preparation tool, not a law firm, brokerage, or advisor. Nothing produced by the
          Service is legal, financial, or professional advice. The forms it generates are drafts.
        </p>
        <p>
          <strong>You are responsible for reviewing every generated document for accuracy and completeness before
          relying on it, sending it to anyone, or signing it.</strong> The Service may extract information
          incorrectly, omit a field, or misinterpret a document. Review is your obligation, not ours.
        </p>
      </Section>

      <Section heading="Signatures">
        <p>
          The Service never fills a signature field, on any form, under any circumstance. Signature lines are left
          blank for the parties to sign themselves. The Service does not provide electronic signature functionality
          and nothing it generates constitutes a signature by any party.
        </p>
      </Section>

      <Section heading="Your account">
        <p>
          You are responsible for the activity on your account and for keeping your credentials secure. Do not share
          your account with others. Notify us at {LEGAL_CONTACT_EMAIL} if you believe your account has been
          accessed without your permission.
        </p>
      </Section>

      <Section heading="Client information">
        <p>
          You will enter personal information about third parties, such as tenants and landlords. You represent that
          you have the right to collect that information and to provide it to the Service for the purpose of
          preparing their paperwork, and that you will handle it in line with your own professional and legal
          obligations. See our <a href="/privacy" className="text-[var(--color-accent)] hover:underline">Privacy
          Policy</a> for how it is handled.
        </p>
      </Section>

      <Section heading="Forms and third-party rights">
        <p>
          The standard forms this Service works with are published by their respective organizations and may be
          subject to their own licensing terms and membership requirements. You are responsible for ensuring you are
          entitled to use those forms in your practice. We are not affiliated with, endorsed by, or acting on behalf
          of any real estate board or association.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          Do not use the Service to break the law, to misrepresent any party, to upload content you have no right to
          upload, or to attempt to access other users&apos; data or disrupt the Service.
        </p>
      </Section>

      <Section heading="Availability">
        <p>
          The Service is provided as is and may change, break, or become unavailable. We do not guarantee uptime,
          and we may modify or discontinue features. Keep your own copies of any documents that matter to you.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for any indirect or consequential loss, or for
          any loss arising from errors in generated documents, reliance on those documents, lost data, or
          unavailability of the Service. Our total liability for any claim relating to the Service is limited to the
          amount you paid us in the twelve months before the claim, or zero if you have paid nothing.
        </p>
      </Section>

      <Section heading="Termination">
        <p>
          You may stop using the Service and request deletion of your account at any time. We may suspend or
          terminate accounts that breach these terms.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          We may update these terms. If we make a significant change, we will update the date at the top of this
          page. Continuing to use the Service after a change means you accept the updated terms.
        </p>
      </Section>

      <Section heading="Governing law">
        <p>These terms are governed by the laws of the Province of Ontario and the laws of Canada applicable there.</p>
      </Section>

      <Section heading="Contact">
        <p>Questions about these terms: {LEGAL_CONTACT_EMAIL}</p>
      </Section>
    </LegalPage>
  );
}
