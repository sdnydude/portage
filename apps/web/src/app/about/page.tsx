import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — Portage",
  description:
    "What Portage is, the beta terms and liability waiver, and how to reach us.",
};

/**
 * /about — the short, public-facing summary that the publish disclaimer,
 * the avatar menu, the sidebar and the More page link to. The full legal
 * text lives on /legal/terms and /legal/privacy; this page summarizes the
 * parts a seller needs before their first listing. Copy approved by the
 * operator 2026-08-23 12:02 ET ("Approved", /ship P4 Phase 3 chunk 3) with
 * the two advisor additions (AI suggestions section, marketplace-terms line).
 */
export default function AboutPage() {
  return (
    <main className="content-container compact-bar-clearance mx-auto px-6 py-12 font-[family-name:var(--font-plus-jakarta)] text-text-primary">
      <h1 className="mb-2 text-3xl font-bold font-[family-name:var(--font-instrument)]">
        About Portage
      </h1>
      <p className="mb-8 text-sm text-text-secondary">Private beta &middot; Updated August 23, 2026</p>

      <p className="mb-8">
        Portage is an AI-assisted inventory and multi-marketplace selling app from
        Digital Harmony Group. Photograph an item, let Porter identify and price
        it, and list it on eBay and Reverb from one place.
      </p>

      <Section title="AI suggestions">
        <p className="mb-4">
          AI-generated titles, descriptions, categories, condition grades and
          prices are suggestions. You review and approve everything before it
          publishes, and you are responsible for the accuracy and legality of
          every listing on each marketplace.
        </p>
      </Section>

      <Section title="Beta terms">
        <p className="mb-4">
          Portage is in private beta. Features may change, break, or be removed
          without notice. Marketplace fees, policies and disputes are between
          you and the marketplace &mdash; eBay&rsquo;s and Reverb&rsquo;s own
          terms continue to govern what you list there.
        </p>
      </Section>

      <Section title="Liability waiver">
        <p className="mb-4">
          Portage is provided &ldquo;as is&rdquo; during the beta, without
          warranty of any kind. To the fullest extent permitted by law, Digital
          Harmony Group is not liable for lost sales, incorrect pricing, listing
          removals, account actions taken by a marketplace, data loss, or any
          indirect or consequential damages arising from use of the beta. Your
          sole remedy is to stop using the service.
        </p>
      </Section>

      <Section title="Privacy and full terms">
        <p className="mb-4">
          The complete{" "}
          <Link href="/legal/terms" className="text-forest-green underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-forest-green underline">
            Privacy Policy
          </Link>{" "}
          apply to every use of Portage, including how your photos, listings and
          marketplace connections are stored.
        </p>
      </Section>

      <Section title="Contact">
        <p className="mb-4">
          <a href="mailto:support@digitalharmonyai.com" className="text-forest-green underline">
            support@digitalharmonyai.com
          </a>
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-semibold font-[family-name:var(--font-instrument)]">{title}</h2>
      {children}
    </section>
  );
}
