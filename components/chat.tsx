"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { WidgetHeadlineControlsProps } from "@/components/widget-headline-controls";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import type { WidgetConfig } from "@/lib/widget-config";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

type WidgetHeadlineEvent =
  | {
      id: string;
      type: "rewrite-request";
      text: string;
      selector: string | null;
    }
  | {
      id: string;
      type: "applied";
      action: "update" | "reset";
      text: string | null;
      selector: string | null;
    }
  | {
      id: string;
      type: "experiment-saved";
      selector: string | null;
      path: string | null;
      controlHeadline: string | null;
      variantHeadline: string | null;
      status: "draft" | "active" | "paused";
    }
  | {
      id: string;
      type: "experiment-error";
      message: string;
    };

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
  isWidget = false,
  widgetToken,
  widgetConfig,
  widgetHeadlineStarter,
  widgetHeadlineEvents,
  onWidgetHeadlineEventsConsumed,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  isWidget?: boolean;
  widgetToken?: string;
  widgetConfig?: WidgetConfig;
  widgetHeadlineStarter?: {
    showControls: boolean;
    onStart: () => void;
    controls: WidgetHeadlineControlsProps;
  };
  widgetHeadlineEvents?: WidgetHeadlineEvent[];
  onWidgetHeadlineEventsConsumed?: (ids: string[]) => void;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  useEffect(() => {
    if (
      !isWidget ||
      !widgetHeadlineEvents ||
      widgetHeadlineEvents.length === 0
    ) {
      return;
    }

    const processedIds: string[] = [];

    for (const event of widgetHeadlineEvents) {
      if (event.type === "rewrite-request") {
        const promptParts = [
          "Rewrite this page headline to improve conversions.",
        ];
        promptParts.push(`Current headline:\n"${event.text}"`);
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: promptParts.join("\n"),
            },
          ],
        });
        processedIds.push(event.id);
        return;
      }

      if (event.type === "applied") {
        const selectorLabel = event.selector ?? "headline";
        const actionLabel =
          event.action === "reset"
            ? "Reset headline to original copy"
            : "Applied new headline copy";
        const messageText = event.text
          ? `${actionLabel} (${selectorLabel}):\n${event.text}`
          : `${actionLabel} (${selectorLabel}).`;
        setMessages((existing) => [
          ...existing,
          {
            id: generateUUID(),
            role: "system",
            parts: [{ type: "text", text: messageText }],
            metadata: { createdAt: new Date().toISOString() },
          },
        ]);
        processedIds.push(event.id);
        continue;
      }

      if (event.type === "experiment-saved") {
        const pathLabel = event.path ? `for ${event.path}` : "for this page";
        const statusLabel =
          event.status === "active"
            ? "Active"
            : event.status === "paused"
              ? "Paused"
              : "Draft";
        const lines: string[] = [
          `${statusLabel} headline test saved ${pathLabel}.`,
        ];
        if (event.variantHeadline) {
          lines.push(`Variant: "${event.variantHeadline}".`);
        } else {
          lines.push("Variant cleared; using control copy.");
        }
        if (event.controlHeadline && event.variantHeadline) {
          lines.push(`Control: "${event.controlHeadline}".`);
        }
        if (event.selector) {
          lines.push(`Selector: ${event.selector}.`);
        }
        setMessages((existing) => [
          ...existing,
          {
            id: generateUUID(),
            role: "system",
            parts: [{ type: "text", text: lines.join("\n") }],
            metadata: { createdAt: new Date().toISOString() },
          },
        ]);
        processedIds.push(event.id);
        continue;
      }

      if (event.type === "experiment-error") {
        const messageText = `Failed to save headline test: ${event.message}`;
        setMessages((existing) => [
          ...existing,
          {
            id: generateUUID(),
            role: "system",
            parts: [{ type: "text", text: messageText }],
            metadata: { createdAt: new Date().toISOString() },
          },
        ]);
        processedIds.push(event.id);
      }
    }

    if (processedIds.length > 0) {
      onWidgetHeadlineEventsConsumed?.(processedIds);
    }
  }, [
    isWidget,
    widgetHeadlineEvents,
    sendMessage,
    setMessages,
    onWidgetHeadlineEventsConsumed,
  ]);

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      if (!isWidget) {
        window.history.replaceState({}, "", `/chat/${id}`);
      }
    }
  }, [query, sendMessage, hasAppendedQuery, id, isWidget]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const containerClassName = cn(
    "overscroll-behavior-contain flex min-w-0 touch-pan-y flex-col",
    isWidget ? "h-full bg-transparent" : "h-dvh bg-background"
  );

  const inputWrapperClassName = cn(
    "sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 px-2 pb-3 md:px-4 md:pb-4",
    isWidget ? "bg-transparent" : "bg-background"
  );

  return (
    <>
      <div
        className={containerClassName}
        data-widget={isWidget ? "true" : undefined}
        data-widget-site={
          isWidget && widgetConfig?.siteName ? widgetConfig.siteName : undefined
        }
        data-widget-status={
          isWidget && widgetConfig?.status ? widgetConfig.status : undefined
        }
        data-widget-token={isWidget ? (widgetToken ?? "") : undefined}
      >
        {!isWidget && (
          <ChatHeader
            chatId={id}
            isReadonly={isReadonly}
            selectedVisibilityType={initialVisibilityType}
          />
        )}

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          isWidget={isWidget}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
          widgetHeadlineStarter={widgetHeadlineStarter}
        />

        <div className={inputWrapperClassName}>
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              isWidget={isWidget}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
              usage={usage}
            />
          )}
        </div>
      </div>

      {!isWidget && (
        <Artifact
          attachments={attachments}
          chatId={id}
          input={input}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          selectedVisibilityType={visibilityType}
          sendMessage={sendMessage}
          setAttachments={setAttachments}
          setInput={setInput}
          setMessages={setMessages}
          status={status}
          stop={stop}
          votes={votes}
        />
      )}

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
