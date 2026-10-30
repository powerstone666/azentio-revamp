interface Props {
  params: Promise<{ id: string }>;
}

export const instant = false;

export default async function EditObservationPage({ params }: Props) {
  const { id } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Edit <span className="az-underline">Observation</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Editing observation {id.slice(0, 8)}... Coming in M2.</p>
    </div>
  );
}