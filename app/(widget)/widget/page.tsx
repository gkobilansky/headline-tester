import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";

type WidgetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WidgetPage({ searchParams }: WidgetPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const headlinetesterParam = resolvedSearchParams.headlinetester;
  const revealWidget = Array.isArray(headlinetesterParam)
    ? headlinetesterParam.includes("1")
    : headlinetesterParam === "1";

  if (!revealWidget) {
    return (
      <div
        aria-hidden="true"
        className="h-full w-full"
        data-widget-state="hidden"
      />
    );
  }

  const tokenParam = resolvedSearchParams.token;
  const widgetToken =
    typeof tokenParam === "string" ? tokenParam : tokenParam?.[0];

  const chatId = generateUUID();

  return (
    <main
      className="flex h-full min-h-0 w-full flex-col bg-transparent"
      data-widget-visible="true"
    >
      <Chat
        autoResume={false}
        id={chatId}
        initialChatModel={DEFAULT_CHAT_MODEL}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        isWidget
        key={chatId}
        widgetToken={widgetToken}
      />
    </main>
  );
}
