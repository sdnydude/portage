import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Portage",
  description:
    "Terms governing your use of the Portage marketplace seller application.",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-[family-name:var(--font-plus-jakarta)] text-[var(--color-text)]">
      <h1 className="mb-2 text-3xl font-bold font-[family-name:var(--font-instrument)]">
        Terms of Service
      </h1>
      <p className="mb-8 text-sm text-[var(--color-text-secondary)]">
        Effective Date: June 3, 2026 &middot; Last Updated: June 3, 2026
      </p>

      <p className="mb-6">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of Portage (the &ldquo;Service&rdquo;), an AI-powered
        personal-effects inventory and multi-marketplace seller application
        operated by Digital Harmony Group, LLC (&ldquo;DHG,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
      </p>

      <p className="mb-6">
        By creating an account or using the Service, you agree to be bound by
        these Terms. If you do not agree, do not use the Service.
      </p>

      <Section title="1. Eligibility">
        <p className="mb-4">
          You must be at least 18 years old and capable of forming a binding
          contract to use the Service. By using the Service, you represent and
          warrant that you meet these requirements.
        </p>
      </Section>

      <Section title="2. Account Registration">
        <p className="mb-4">
          You must provide accurate, complete, and current information when
          creating your account. You are responsible for maintaining the
          confidentiality of your login credentials and for all activity that
          occurs under your account. Notify us immediately if you suspect
          unauthorized access.
        </p>
      </Section>

      <Section title="3. Description of Service">
        <p className="mb-4">
          Portage provides tools to manage personal-effects inventory, create
          and synchronize marketplace listings, process orders, and utilize
          AI-assisted features for item scanning, listing optimization, and
          photo enhancement. The Service integrates with third-party
          marketplaces including eBay and Reverb.
        </p>
      </Section>

      <Section title="4. Third-Party Marketplace Integrations">
        <p className="mb-4">
          When you connect a third-party marketplace account to the Service:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>
            You authorize us to access and interact with the marketplace on your
            behalf using OAuth tokens or other authorized credentials.
          </li>
          <li>
            You remain bound by the marketplace&apos;s own terms of service,
            policies, and user agreements. It is your responsibility to comply
            with those terms.
          </li>
          <li>
            You acknowledge that the Service accesses marketplace data through
            the marketplace&apos;s developer APIs and is subject to the
            applicable API license agreements, including but not limited to the{" "}
            <a
              href="https://developer.ebay.com/join/api-license-agreement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              eBay API License Agreement
            </a>
            . eBay Inc. is a third-party beneficiary of these Terms with respect
            to your use of eBay marketplace data through the Service, and may
            enforce the terms of the eBay API License Agreement directly against
            you.
          </li>
          <li>
            You may revoke marketplace authorization at any time through the
            Service&apos;s Settings page or directly through the marketplace
            platform. Revocation will stop future data access but does not
            automatically delete previously collected data; see our{" "}
            <a
              href="/legal/privacy"
              className="text-[var(--color-primary)] underline"
            >
              Privacy Policy
            </a>{" "}
            for data deletion procedures.
          </li>
          <li>
            The sublicense granted to you to display marketplace content
            (e.g., eBay listing data) through the Service is non-exclusive and
            revocable at any time by us or the marketplace provider.
          </li>
        </ul>
      </Section>

      <Section title="5. Acceptable Use">
        <p className="mb-4">You agree not to:</p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>
            Use the Service for any unlawful purpose or in violation of any
            applicable law or regulation.
          </li>
          <li>
            Use the Service to collect, aggregate, or derive marketplace data
            about other users beyond what is necessary for your own buying or
            selling transactions.
          </li>
          <li>
            Attempt to access accounts, systems, or data not intended for you.
          </li>
          <li>
            Interfere with or disrupt the integrity or performance of the
            Service.
          </li>
          <li>
            Reverse-engineer, decompile, or disassemble any part of the
            Service.
          </li>
          <li>
            Use automated means to access the Service in a manner that exceeds
            reasonable use (e.g., scraping, excessive API calls).
          </li>
          <li>
            Use marketplace data obtained through the Service to engage in
            seller arbitrage, including automatically repricing listings in
            response to third-party price changes or automatically ordering
            sold items from other sites.
          </li>
          <li>
            Collect eBay usernames, passwords, or personal information of other
            marketplace users except as strictly necessary for completing
            transactions displayed in the Service.
          </li>
        </ul>
      </Section>

      <Section title="6. Subscription and Billing">
        <p className="mb-4">
          Certain features of the Service require a paid subscription. Billing
          is handled by Stripe. By subscribing, you authorize us to charge your
          payment method on a recurring basis at the applicable subscription
          rate. You may cancel at any time through the Settings page; access
          continues until the end of the current billing period.
        </p>
        <p className="mb-4">
          We reserve the right to change subscription pricing with 30
          days&apos; notice. Continued use after a price change constitutes
          acceptance.
        </p>
      </Section>

      <Section title="7. AI-Powered Features">
        <p className="mb-4">
          The Service includes AI-powered features (item scanning, listing
          optimization, the Porter AI assistant, photo enhancement). These
          features use third-party AI services (Anthropic Claude). AI-generated
          content, including suggested titles, descriptions, and pricing, is
          provided as a suggestion only. You are solely responsible for
          reviewing and approving all content before it is published to any
          marketplace.
        </p>
        <p className="mb-4">
          We do not guarantee the accuracy, completeness, or suitability of
          AI-generated content. AI suggestions for pricing are informational and
          do not constitute financial or professional advice.
        </p>
      </Section>

      <Section title="8. Intellectual Property">
        <p className="mb-4">
          The Service, including its design, code, features, and documentation,
          is owned by DHG and protected by intellectual property laws. Your use
          of the Service does not grant you ownership of any intellectual
          property in the Service.
        </p>
        <p className="mb-4">
          You retain ownership of the content you create and upload (item
          descriptions, photographs, etc.). By using the Service, you grant us a
          limited, non-exclusive license to use your content solely to provide
          and improve the Service.
        </p>
      </Section>

      <Section title="9. Disclaimer of Warranties">
        <p className="mb-4 uppercase">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available&rdquo; without warranties of any kind, express or implied,
          including but not limited to warranties of merchantability, fitness for
          a particular purpose, and non-infringement.
        </p>
        <p className="mb-4">
          We do not warrant that the Service will be uninterrupted, error-free,
          or secure; that marketplace integrations will always be available; or
          that AI-generated content will be accurate or suitable for any
          particular purpose.
        </p>
      </Section>

      <Section title="10. Limitation of Liability">
        <p className="mb-4 uppercase">
          To the maximum extent permitted by law, DHG shall not be liable for
          any indirect, incidental, special, consequential, or punitive damages,
          including but not limited to loss of profits, data, or business
          opportunities, arising from your use of the Service, even if advised
          of the possibility of such damages.
        </p>
        <p className="mb-4">
          Our total liability for any claim arising from or related to the
          Service shall not exceed the amount you paid to us in the twelve (12)
          months preceding the claim.
        </p>
      </Section>

      <Section title="11. Indemnification">
        <p className="mb-4">
          You agree to indemnify, defend, and hold harmless DHG, its officers,
          directors, employees, and agents from any claims, liabilities, damages,
          losses, and expenses (including reasonable attorneys&apos; fees)
          arising from: (a) your use of the Service; (b) your violation of these
          Terms; (c) your violation of any third-party rights, including
          marketplace terms of service; or (d) any content you create, upload,
          or publish through the Service.
        </p>
      </Section>

      <Section title="12. Termination">
        <p className="mb-4">
          We may suspend or terminate your access to the Service at any time,
          with or without cause, with or without notice. You may terminate your
          account at any time through the Settings page or by contacting us.
          Upon termination, your right to use the Service ceases immediately.
          Provisions that by their nature should survive termination (including
          Sections 8&ndash;11 and 14) shall survive.
        </p>
      </Section>

      <Section title="13. Changes to These Terms">
        <p className="mb-4">
          We may update these Terms from time to time. We will notify you of
          material changes by posting the updated Terms on this page with a
          revised &ldquo;Last Updated&rdquo; date and, for material changes,
          through an in-app notification or email. Your continued use of the
          Service after changes are posted constitutes acceptance.
        </p>
      </Section>

      <Section title="14. Governing Law and Dispute Resolution">
        <p className="mb-4">
          These Terms are governed by and construed in accordance with the laws
          of the State of New York, without regard to conflict-of-law
          principles. Any dispute arising from these Terms or the Service shall
          be resolved in the state or federal courts located in New York County,
          New York, and you consent to the personal jurisdiction of such courts.
        </p>
      </Section>

      <Section title="15. Contact Us">
        <p className="mb-4">
          If you have questions about these Terms, contact us at:
        </p>
        <address className="mb-8 not-italic">
          Digital Harmony Group, LLC
          <br />
          Email:{" "}
          <a
            href="mailto:legal@digitalharmonyai.com"
            className="text-[var(--color-primary)] underline"
          >
            legal@digitalharmonyai.com
          </a>
        </address>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-semibold font-[family-name:var(--font-instrument)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
