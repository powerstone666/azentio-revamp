interface Props {
  params: Promise<{ offeringId: string }>;
}

export const instant = false;

export default async function ClientDemoRunnerPage({ params }: Props) {
  const { offeringId } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Demo <span className="az-underline">Runner</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Interactive sandbox for offering {offeringId}. Coming in M6.</p>
    </div>
  );
}