export default function WorkspaceSelectPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-az-grey-bg">
      <div className="w-full max-w-md rounded-[12px] bg-white p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-az-navy">Select Workspace</h1>
        <p className="mt-2 text-az-text-muted">
          You belong to multiple organizations. Choose one to continue.
        </p>
        <p className="mt-4 text-sm text-az-text-muted">Coming in M1.</p>
      </div>
    </div>
  );
}