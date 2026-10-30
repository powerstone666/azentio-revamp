/**
 * Portal shell layout — renders top bar, workspace switcher, sidebar.
 * This layout does NOT make authorization decisions; each page
 * and Server Action authorizes independently through the DAL.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Placeholder: top bar + workspace switcher + sidebar */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}