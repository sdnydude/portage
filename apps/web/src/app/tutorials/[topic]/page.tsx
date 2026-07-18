import { notFound } from "next/navigation";
import Link from "next/link";
import { getTopic, TUTORIAL_TOPICS } from "@/lib/tutorials";
import { TutorialPlayer } from "@/components/tutorials/tutorial-player";

export function generateStaticParams() {
  return TUTORIAL_TOPICS.map((t) => ({ topic: t.slug }));
}

export default async function TutorialTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Link href="/tutorials" className="-ml-1 p-1" aria-label="Back to tutorials">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="font-[family-name:var(--font-instrument)] text-lg font-semibold text-text-primary">
            {topic.title}
          </h1>
        </div>
      </header>
      <TutorialPlayer topic={topic} />
    </div>
  );
}
