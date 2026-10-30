interface Props {
  params: Promise<{ themeId: string }>;
}

export const instant = false;

export default async function ThemeDetailPage({ params }: Props) {
  const { themeId } = await params;
  return (
    <div>
      <h2 className="text-[30px] font-semibold text-az-navy">
        Theme <span className="az-underline">Explorer</span>
      </h2>
      <p className="mt-2 text-az-text-muted">Theme {themeId.slice(0, 8)} exploration. Coming in M3.</p>
    </div>
  );
}