interface Props {
  params: Promise<{ category: string }>;
}

export const instant = false;

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  return (
    <section className="py-20">
      <h2 className="text-[38px] font-semibold capitalize text-az-navy">
        <span className="az-underline">{category.replace('-', ' ')}</span>
      </h2>
      <p className="mt-4 text-az-text-muted">Coming in M5.</p>
    </section>
  );
}