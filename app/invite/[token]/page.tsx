interface Props {
  params: Promise<{ token: string }>;
}

export const instant = false;

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-az-grey-bg">
      <div className="w-full max-w-md rounded-[12px] bg-white p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-az-navy">Accept Invitation</h1>
        <p className="mt-2 text-sm text-az-text-muted">
          Token: {token.slice(0, 8)}...
        </p>
        <p className="mt-4 text-az-text-muted">Invitation acceptance flow coming in M1.</p>
      </div>
    </div>
  );
}