import { WidgetRoot } from "@/components/widget-root";

type WidgetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WidgetPage({ searchParams }: WidgetPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const headlinetesterParam = resolvedSearchParams.headlinetester;
  const revealWidget = Array.isArray(headlinetesterParam)
    ? headlinetesterParam.includes("1")
    : headlinetesterParam === "1";

  const tokenParam = resolvedSearchParams.token;
  const widgetToken =
    typeof tokenParam === "string" ? tokenParam : tokenParam?.[0];

  return (
    <main
      className="flex h-full min-h-0 w-full flex-col bg-transparent"
      data-widget-visible={revealWidget ? "true" : undefined}
    >
      <WidgetRoot initialReveal={revealWidget} widgetToken={widgetToken} />
    </main>
  );
}
