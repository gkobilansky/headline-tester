"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const MODE_EVENT = "headlineTester:mode";
const DIMENSIONS_EVENT = "headlineTester:dimensions";

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
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const collapsed = launcherVisible && !chatOpen;

  if (!chatIdRef.current) {
    chatIdRef.current = generateUUID();
  }

  useEffect(() => {
    if (initialReveal) {
      setLauncherVisible(true);
      setChatOpen(true);
    }
  }, [initialReveal]);

  const postMode = useCallback((mode: "hidden" | "launcher" | "chat") => {
    window.parent?.postMessage({ mode, type: MODE_EVENT }, "*");
  }, []);

  const showLauncher = useCallback(
    (openChat: boolean) => {
      postMode(openChat ? "chat" : "launcher");
      setLauncherVisible(true);
      if (openChat) {
        setChatOpen(true);
      }
    },
    [postMode]
  );

  const hideWidget = useCallback(() => {
    postMode("hidden");
    setChatOpen(false);
    setLauncherVisible(false);
  }, [postMode]);

  const handleLauncherClick = useCallback(() => {
    postMode("chat");
    setLauncherVisible(true);
    setChatOpen(true);
  }, [postMode]);

  const handleClose = useCallback(() => {
    postMode("launcher");
    setLauncherVisible(true);
    setChatOpen(false);
  }, [postMode]);

  useEffect(() => {
    const mode = chatOpen ? "chat" : launcherVisible ? "launcher" : "hidden";
    postMode(mode);
  }, [chatOpen, launcherVisible, postMode]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      window.parent?.postMessage(
        {
          height: Math.ceil(height),
          type: DIMENSIONS_EVENT,
          width: Math.ceil(width),
        },
        "*"
      );
    });

    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<WidgetMessage>) => {
      const message = normaliseMessage(event.data);
      if (!message.type) {
        return;
      }

      if (message.type === SHOW_EVENT) {
        const shouldOpen = message.open === true || message.mode === "open";
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
        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
        : "pointer-events-none hidden translate-y-4 scale-95 opacity-0"
    );
  }, [chatOpen]);

  const surfaceClassName = useMemo(() => {
    return cn(
      "pointer-events-none fixed right-0 bottom-0 flex items-end justify-end",
      collapsed ? "p-0" : "p-4"
    );
  }, [collapsed]);

  const stackClassName = useMemo(() => {
    return cn(
      "pointer-events-auto flex flex-col items-end",
      collapsed ? "gap-0" : "gap-3"
    );
  }, [collapsed]);

  return (
    <div
      aria-hidden={!launcherVisible && !chatOpen}
      className={surfaceClassName}
      data-widget-state={collapsed ? "launcher" : chatOpen ? "chat" : "hidden"}
      data-widget-surface="true"
      ref={surfaceRef}
    >
      <div className={stackClassName}>
        <div className={chatPanelClassName} data-widget-panel="true">
          <button
            aria-label="Close chat"
            className={cn(
              "absolute top-3 right-3 z-20 inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              chatOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={handleClose}
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
            onClick={handleLauncherClick}
            type="button"
          >
            <span className="font-semibold text-base">HT</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
