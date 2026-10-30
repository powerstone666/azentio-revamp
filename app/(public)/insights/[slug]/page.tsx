interface Props {
  params: Promise<{ slug: string }>;
}

export const instant = false;

export default async function InsightArticlePage({ params }: Props) {
  const { slug } = await params;
  return (
    <article className="py-20">
      <h2 className="text-[38px] font-semibold capitalize text-az-navy">
        <span className="az-underline">{slug.replace('-', ' ')}</span>
      </h2>
      <p className="mt-4 text-az-text-muted">Coming in M5.</p>
    </article>
  );
}