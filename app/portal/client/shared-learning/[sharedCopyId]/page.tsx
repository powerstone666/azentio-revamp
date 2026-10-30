interface Props {
  params: Promise<{ sharedCopyId: string }>;
}

export const instant = false;

export default async function SharedCopyDetailPage({ params }: Props) {
  const { sharedCopyId } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Shared <span className="az-underline">Insight</span>
      </h2>
      <p className="mt-2 text-az-text-muted">De-identified shared observation {sharedCopyId.slice(0, 8)}... Coming in M3.</p>
    </div>
  );
}