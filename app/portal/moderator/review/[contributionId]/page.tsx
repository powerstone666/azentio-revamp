interface Props {
  params: Promise<{ contributionId: string }>;
}

export const instant = false;

export default async function ModeratorReviewPage({ params }: Props) {
  const { contributionId } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Redaction <span className="az-underline">Workbench</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Split-screen review for contribution {contributionId.slice(0, 8)}... Coming in M2.</p>
    </div>
  );
}