interface Props {
  params: Promise<{ ideaId: string }>;
}

export const instant = false;

export default async function ProductOwnerIdeaDetailPage({ params }: Props) {
  const { ideaId } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Idea <span className="az-underline">Management</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Idea {ideaId.slice(0, 8)} — status lifecycle and feedback loop. Coming in M3.</p>
    </div>
  );
}