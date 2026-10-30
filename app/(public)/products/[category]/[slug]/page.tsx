interface Props {
  params: Promise<{ category: string; slug: string }>;
}

export const instant = false;

export default async function ProductDetailPage({ params }: Props) {
  const { category, slug } = await params;
  return (
    <section className="py-20">
      <h2 className="text-[38px] font-semibold capitalize text-az-navy">
        <span className="az-underline">{slug.replace('-', ' ')}</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Category: {category.replace('-', ' ')}</p>
      <p className="mt-4 text-az-text-muted">Coming in M5.</p>
    </section>
  );
}