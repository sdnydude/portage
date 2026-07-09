import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Portage",
  description:
    "How Portage collects, uses, and protects your information when you use our marketplace seller application.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-[family-name:var(--font-plus-jakarta)] text-[var(--color-text)]">
      <h1 className="mb-2 text-3xl font-bold font-[family-name:var(--font-instrument)]">
        Privacy Policy
      </h1>
      <p className="mb-8 text-sm text-[var(--color-text-secondary)]">
        Effective Date: June 3, 2026 &middot; Last Updated: June 3, 2026
      </p>

      <p className="mb-6">
        Digital Harmony Group, LLC (&ldquo;DHG,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates Portage, an
        AI-powered personal-effects inventory and multi-marketplace seller
        application (the &ldquo;Service&rdquo;). This Privacy Policy explains
        how we collect, use, disclose, and safeguard your information when you
        use our Service, including when you connect third-party marketplace
        accounts — eBay and Reverb.
      </p>

      <p className="mb-6">
        By using the Service, you agree to the collection and use of information
        in accordance with this Privacy Policy. If you do not agree, please do
        not use the Service.
      </p>

      <Section title="1. Information We Collect">
        <SubSection title="1.1 Information You Provide">
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Account information:</strong> name, email address, and
              password when you register.
            </li>
            <li>
              <strong>Inventory data:</strong> item descriptions, photographs,
              condition notes, pricing, and category information you enter or
              upload.
            </li>
            <li>
              <strong>Seller profile:</strong> business name, location,
              return-policy preferences, and shipping settings.
            </li>
            <li>
              <strong>Payment information:</strong> billing details processed by
              our third-party payment processor (Stripe). We do not store full
              credit-card numbers.
            </li>
          </ul>
        </SubSection>

        <SubSection title="1.2 Information from Third-Party Marketplaces">
          <p className="mb-4">
            When you connect a marketplace account (eBay or Reverb),
            we receive data through their APIs under their respective developer
            programs. This may include:
          </p>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              Your marketplace user ID and account display name.
            </li>
            <li>
              Listing data: titles, descriptions, photos, item specifics,
              pricing, and category information for listings you create or manage
              through the Service.
            </li>
            <li>
              Order and transaction data: buyer shipping addresses, order
              totals, tracking numbers, and fulfillment status for orders
              placed through your listings.
            </li>
            <li>
              Messaging data: buyer inquiries and your responses sent through
              the marketplace messaging system.
            </li>
            <li>
              OAuth tokens: encrypted access and refresh tokens that authorize
              the Service to act on your behalf. These are stored encrypted at
              rest using AES-256-GCM.
            </li>
          </ul>
          <p className="mb-4">
            We access only the data necessary to provide the Service features
            you use. We do not access data belonging to other marketplace users
            except as strictly necessary to facilitate your use of marketplace
            services (e.g., displaying buyer information on your orders).
          </p>
        </SubSection>

        <SubSection title="1.3 Automatically Collected Information">
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Usage data:</strong> pages visited, features used, and
              actions taken within the Service.
            </li>
            <li>
              <strong>Device information:</strong> browser type, operating
              system, screen resolution, and device identifiers.
            </li>
            <li>
              <strong>Log data:</strong> IP address, access times, and
              referring URLs.
            </li>
          </ul>
        </SubSection>
      </Section>

      <Section title="2. How We Use Your Information">
        <p className="mb-4">We use collected information to:</p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>Provide, operate, and maintain the Service.</li>
          <li>
            Create, manage, and synchronize your inventory listings across
            connected marketplaces.
          </li>
          <li>
            Process orders and facilitate shipping for marketplace
            transactions.
          </li>
          <li>
            Provide AI-powered features, including item scanning, listing
            optimization, photo enhancement, and the Porter AI assistant. Your
            item data may be sent to third-party AI providers (Anthropic) for
            processing; no data is used to train AI models.
          </li>
          <li>
            Communicate with you about your account, transactions, and Service
            updates.
          </li>
          <li>
            Detect, prevent, and address technical issues and security threats.
          </li>
          <li>
            Enforce our Terms of Service and comply with legal obligations.
          </li>
        </ul>
        <p className="mb-4">
          We do not use your information to derive aggregated statistics about
          marketplace users, estimate or display reserve auction prices, derive
          sales rates or gross merchandise values, or collect statistical data
          about eBay or any connected marketplace beyond what is specific to
          your own account and displayed only to you.
        </p>
      </Section>

      <Section title="3. How We Share Your Information">
        <p className="mb-4">
          We do not sell, rent, or trade your personal information. We share
          information only in the following circumstances:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>
            <strong>Connected marketplaces:</strong> To create listings, process
            orders, and send messages on your behalf through the marketplaces
            you connect: eBay and Reverb.
          </li>
          <li>
            <strong>Service providers:</strong> With third-party providers who
            assist in operating the Service (e.g., Stripe for payment
            processing, Anthropic for AI features, cloud hosting providers).
            These providers are contractually obligated to protect your data and
            use it only for the services they provide to us.
          </li>
          <li>
            <strong>Legal requirements:</strong> When required by law,
            regulation, legal process, or governmental request.
          </li>
          <li>
            <strong>Safety and rights:</strong> To protect the rights, property,
            or safety of DHG, our users, or the public.
          </li>
          <li>
            <strong>Business transfers:</strong> In connection with a merger,
            acquisition, or sale of all or a portion of our assets, with notice
            to you.
          </li>
        </ul>
      </Section>

      <Section title="4. Data Retention and Deletion">
        <p className="mb-4">
          We retain your information for as long as your account is active or as
          needed to provide the Service. When you disconnect a marketplace
          account, we delete the associated OAuth tokens promptly. When you
          delete your Portage account, we delete your personal information
          within 30 days, except where retention is required by law or
          legitimate business purpose (e.g., transaction records for tax
          compliance).
        </p>
        <p className="mb-4">
          You may request deletion of your data at any time by contacting us at
          the address below.
        </p>
      </Section>

      <Section title="5. Data Security">
        <p className="mb-4">
          We implement appropriate technical and organizational measures to
          protect your information, including:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>
            Encryption of marketplace OAuth tokens at rest using AES-256-GCM
            with a dedicated encryption key.
          </li>
          <li>
            HTTPS/TLS encryption for all data in transit.
          </li>
          <li>
            Bcrypt-hashed passwords with secure JWT-based authentication.
          </li>
          <li>
            Role-based access controls for administrative functions.
          </li>
          <li>
            Regular security review and adherence to OWASP secure coding
            principles.
          </li>
        </ul>
        <p className="mb-4">
          No method of transmission or storage is 100% secure. While we strive
          to protect your information, we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="6. Your Rights and Choices">
        <p className="mb-4">Depending on your jurisdiction, you may have the right to:</p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>Access the personal information we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data.</li>
          <li>Object to or restrict certain processing activities.</li>
          <li>Receive your data in a portable format.</li>
          <li>Withdraw consent where processing is based on consent.</li>
        </ul>
        <p className="mb-4">
          You may revoke marketplace authorization at any time through the
          Settings page in the Service or directly through the marketplace
          platform. Revoking authorization will stop the Service from accessing
          your marketplace data but will not delete data already collected;
          contact us to request deletion.
        </p>
      </Section>

      <Section title="7. Third-Party Marketplace Policies">
        <p className="mb-4">
          Our use of data from connected marketplaces is governed by their
          respective developer agreements and privacy policies:
        </p>
        <ul className="mb-4 list-disc space-y-2 pl-6">
          <li>
            <strong>eBay:</strong> Subject to the{" "}
            <a
              href="https://developer.ebay.com/join/api-license-agreement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              eBay API License Agreement
            </a>{" "}
            and{" "}
            <a
              href="https://www.ebay.com/help/policies/member-behavior-policies/user-privacy-notice?id=4260"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] underline"
            >
              eBay User Privacy Notice
            </a>
            . We do not process eBay personal information in any manner that eBay
            itself cannot under its Privacy Notice.
          </li>
          <li>
            <strong>Reverb:</strong> Subject to Reverb&apos;s API Terms and
            Privacy Policy.
          </li>
        </ul>
      </Section>

      <Section title="8. Children's Privacy">
        <p className="mb-4">
          The Service is not intended for individuals under the age of 18. We do
          not knowingly collect personal information from children. If you
          believe we have collected information from a child, please contact us
          and we will delete it promptly.
        </p>
      </Section>

      <Section title="9. Changes to This Policy">
        <p className="mb-4">
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the updated policy on this page
          with a revised &ldquo;Last Updated&rdquo; date. Your continued use
          of the Service after changes are posted constitutes acceptance of the
          updated policy.
        </p>
      </Section>

      <Section title="10. Contact Us">
        <p className="mb-4">
          If you have questions about this Privacy Policy or wish to exercise
          your data rights, contact us at:
        </p>
        <address className="mb-8 not-italic">
          Digital Harmony Group, LLC
          <br />
          Email:{" "}
          <a
            href="mailto:privacy@digitalharmonyai.com"
            className="text-[var(--color-primary)] underline"
          >
            privacy@digitalharmonyai.com
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

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-lg font-medium">{title}</h3>
      {children}
    </div>
  );
}
