"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat";
import {
  WidgetHeadlineControls,
  type WidgetHeadlineContext,
} from "@/components/widget-headline-controls";
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
const DOM_CONTEXT_EVENT = "headlineTester:domContext";
const UPDATE_HEADLINE_EVENT = "headlineTester:updateHeadline";
const HEADLINE_UPDATED_EVENT = "headlineTester:headlineUpdated";
const REQUEST_DOM_CONTEXT_EVENT = "headlineTester:requestDomContext";

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
  const [headlineContext, setHeadlineContext] = useState<WidgetHeadlineContext>({
    selector: null,
    text: null,
    originalText: null,
    found: false,
  });
  const [headlineStatus, setHeadlineStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [headlineError, setHeadlineError] = useState<string | null>(null);
  const chatIdRef = useRef<string>();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);
  const statusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
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

  const requestDomContext = useCallback(() => {
    window.parent?.postMessage({ type: REQUEST_DOM_CONTEXT_EVENT }, "*");
  }, []);

  const applyHeadlineUpdate = useCallback(
    (nextHeadline: string) => {
      if (pendingRequestIdRef.current) {
        return;
      }

      const trimmed = nextHeadline.trim();
      if (!trimmed) {
        setHeadlineStatus("error");
        setHeadlineError("Headline cannot be empty.");
        return;
      }

      if ((headlineContext.text ?? "").trim() === trimmed) {
        setHeadlineStatus("idle");
        setHeadlineError(null);
        return;
      }

      const requestId = generateUUID();
      pendingRequestIdRef.current = requestId;
      setHeadlineStatus("pending");
      setHeadlineError(null);
      window.parent?.postMessage(
        {
          type: UPDATE_HEADLINE_EVENT,
          text: trimmed,
          requestId,
        },
        "*"
      );
    },
    [headlineContext.text]
  );

  const resetHeadline = useCallback(() => {
    if (pendingRequestIdRef.current) {
      return;
    }

    if (!headlineContext.originalText) {
      setHeadlineStatus("error");
      setHeadlineError("No saved headline to restore.");
      return;
    }

    const requestId = generateUUID();
    pendingRequestIdRef.current = requestId;
    setHeadlineStatus("pending");
    setHeadlineError(null);
    window.parent?.postMessage(
      {
        type: UPDATE_HEADLINE_EVENT,
        reset: true,
        requestId,
      },
      "*"
    );
  }, [headlineContext.originalText]);

  useEffect(() => {
    const mode = chatOpen ? "chat" : launcherVisible ? "launcher" : "hidden";
    postMode(mode);
  }, [chatOpen, launcherVisible, postMode]);

  useEffect(() => {
    if (statusResetTimeoutRef.current) {
      clearTimeout(statusResetTimeoutRef.current);
      statusResetTimeoutRef.current = null;
    }

    if (headlineStatus === "success") {
      statusResetTimeoutRef.current = setTimeout(() => {
        setHeadlineStatus("idle");
        statusResetTimeoutRef.current = null;
      }, 1800);
    }

    return () => {
      if (statusResetTimeoutRef.current) {
        clearTimeout(statusResetTimeoutRef.current);
        statusResetTimeoutRef.current = null;
      }
    };
  }, [headlineStatus]);

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
    const handleMessage = (event: MessageEvent<unknown>) => {
      const data = event.data as Record<string, unknown> | WidgetMessage | null;

      if (data && typeof data === "object" && "type" in data) {
        const typed = data as Record<string, unknown> & { type: string };

        if (typed.type === DOM_CONTEXT_EVENT) {
          setHeadlineContext((prev) => {
            const selector =
              typeof typed.selector === "string" ? typed.selector : prev.selector;
            const text =
              typeof typed.text === "string" ? typed.text : prev.text;
            const original =
              typeof typed.originalText === "string"
                ? typed.originalText
                : prev.originalText ?? text ?? null;
            const found =
              typed.found === false ? false : Boolean(text ?? original);

            return {
              selector,
              text,
              originalText: original,
              found,
            };
          });

          if (typed.found === false) {
            setHeadlineStatus((current) =>
              current === "pending" ? current : "error"
            );
            setHeadlineError("Headline element not found on this page.");
          } else {
            setHeadlineStatus((current) => {
              if (current === "pending") {
                return current;
              }
              if (current === "error") {
                return "idle";
              }
              return current;
            });
            setHeadlineError(null);
          }

          return;
        }

        if (typed.type === HEADLINE_UPDATED_EVENT) {
          const requestId =
            typeof typed.requestId === "string" ? typed.requestId : null;

          if (
            pendingRequestIdRef.current &&
            requestId &&
            pendingRequestIdRef.current !== requestId
          ) {
            return;
          }

          pendingRequestIdRef.current = null;

          if (typed.status === "success") {
            setHeadlineStatus("success");
            setHeadlineError(null);
            setHeadlineContext((prev) => {
              const selector =
                typeof typed.selector === "string"
                  ? typed.selector
                  : prev.selector;
              const text =
                typeof typed.text === "string" ? typed.text : prev.text;
              const original = prev.originalText ?? text ?? null;
              return {
                selector,
                text,
                originalText: original,
                found: true,
              };
            });

            if (typeof typed.text !== "string") {
              requestDomContext();
            }
          } else if (typed.status === "error") {
            const reason =
              typeof typed.reason === "string"
                ? typed.reason
                : "Unable to update the headline.";
            setHeadlineStatus("error");
            setHeadlineError(reason);
          }

          return;
        }
      }

      const message = normaliseMessage(data as WidgetMessage);
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
    requestDomContext();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [hideWidget, requestDomContext, showLauncher]);

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

  const isHeadlinePending = headlineStatus === "pending";

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
            <div className="px-4 pb-3">
              <WidgetHeadlineControls
                context={headlineContext}
                error={headlineError}
                isPending={isHeadlinePending}
                onApply={applyHeadlineUpdate}
                onReset={resetHeadline}
                status={headlineStatus}
              />
            </div>
            <div className="flex-1 min-h-0">
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
