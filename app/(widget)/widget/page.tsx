import { notFound } from "next/navigation";
import { WidgetRoot } from "@/components/widget-root";
import { getWidgetConfig } from "@/lib/db/queries";
import { normalizeWidgetPath, normalizeWidgetToken } from "@/lib/widget-config";

type WidgetSearchParams = Record<string, string | string[] | undefined>;

type WidgetPageProps = {
  searchParams?: Promise<WidgetSearchParams>;
};

export default async function WidgetPage({ searchParams }: WidgetPageProps) {
  const resolvedSearchParams = searchParams
    ? await searchParams
    : ({
        headlinetester: undefined,
        token: undefined,
        path: undefined,
      } satisfies WidgetSearchParams);

  const headlinetesterParam = resolvedSearchParams.headlinetester;
  const revealWidget = Array.isArray(headlinetesterParam)
    ? headlinetesterParam.includes("1")
    : headlinetesterParam === "1";

  const widgetToken = normalizeWidgetToken(resolvedSearchParams.token ?? null);
  const widgetPath = normalizeWidgetPath(resolvedSearchParams.path ?? null);
  if (!widgetToken) {
    notFound();
  }

  const widgetConfig = await getWidgetConfig(widgetToken, widgetPath);
  if (!widgetConfig) {
    notFound();
  }

  return (
    <main
      className="flex h-full min-h-0 w-full flex-col bg-transparent"
      data-widget-visible={revealWidget ? "true" : undefined}
    >
      <WidgetRoot config={widgetConfig} initialReveal={revealWidget} />
    </main>
  );
}
