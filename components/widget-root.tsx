"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Chat } from "@/components/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { cn, generateUUID } from "@/lib/utils";

type WidgetRootProps = {
  initialReveal?: boolean;
  widgetToken?: string;
};

const READY_EVENT = "headlineTester:ready";
const SHOW_EVENT = "headlineTester:show";
const HIDE_EVENT = "headlineTester:hide";

type WidgetMessage =
  | string
  | {
      type?: string;
      open?: boolean;
      mode?: "open" | "launcher";
    };

function normaliseMessage(data: WidgetMessage) {
  if (typeof data === "string") {
    return { type: data };
  }
  if (data && typeof data === "object") {
    return {
      type: data.type,
      open: data.open,
      mode: data.mode,
    };
  }
  return { type: undefined };
}

export function WidgetRoot({
  initialReveal = false,
  widgetToken,
}: WidgetRootProps) {
  const [launcherVisible, setLauncherVisible] = useState(initialReveal);
  const [chatOpen, setChatOpen] = useState(initialReveal);
  const chatIdRef = useRef<string>();

  if (!chatIdRef.current) {
    chatIdRef.current = generateUUID();
  }

  useEffect(() => {
    if (initialReveal) {
      setLauncherVisible(true);
      setChatOpen(true);
    }
  }, [initialReveal]);

  const showLauncher = useCallback((openChat: boolean) => {
    setLauncherVisible(true);
    if (openChat) {
      setChatOpen(true);
    }
  }, []);

  const hideWidget = useCallback(() => {
    setChatOpen(false);
    setLauncherVisible(false);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<WidgetMessage>) => {
      const message = normaliseMessage(event.data);
      if (!message.type) {
        return;
      }

      if (message.type === SHOW_EVENT) {
        const shouldOpen =
          message.open === true || message.mode === "open";
        showLauncher(shouldOpen);
      } else if (message.type === HIDE_EVENT) {
        hideWidget();
      }
    };

    window.addEventListener("message", handleMessage);
    window.parent?.postMessage({ type: READY_EVENT }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [hideWidget, showLauncher]);

  const launchButton = launcherVisible && !chatOpen;

  useEffect(() => {
    if (!launcherVisible) {
      setChatOpen(false);
    }
  }, [launcherVisible]);

  const chatId = chatIdRef.current;

  const chatPanelClassName = useMemo(() => {
    return cn(
      "relative flex h-[560px] w-[360px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_24px_70px_rgba(15,23,42,0.3)] transition-all duration-200 ease-out",
      chatOpen
        ? "pointer-events-auto opacity-100 translate-y-0 scale-100"
        : "hidden pointer-events-none opacity-0 translate-y-4 scale-95"
    );
  }, [chatOpen]);

  return (
    <div
      aria-hidden={!launcherVisible && !chatOpen}
      className="pointer-events-none fixed inset-0 flex items-end justify-end p-4"
      data-widget-surface="true"
    >
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <div className={chatPanelClassName} data-widget-panel="true">
          <button
            aria-label="Close chat"
            className={cn(
              "absolute right-3 top-3 z-20 inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              chatOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => {
              setLauncherVisible(true);
              setChatOpen(false);
            }}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
          <div className="flex h-full flex-col pt-12">
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
          </div>
        </div>

        {launchButton ? (
          <button
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_18px_45px_rgba(37,99,235,0.35)] transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={() => setChatOpen(true)}
            type="button"
          >
            <span className="text-base font-semibold">HT</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
