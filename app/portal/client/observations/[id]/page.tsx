interface Props {
  params: Promise<{ id: string }>;
}

export const instant = false;

export default async function ObservationDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Observation <span className="az-underline">Detail</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Viewing observation {id.slice(0, 8)}... Coming in M2.</p>
    </div>
  );
}