"use client";

import { XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chat } from "@/components/chat";
import type {
  WidgetHeadlineContext,
  WidgetHeadlineControlsProps,
} from "@/components/widget-headline-controls";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { cn, generateUUID } from "@/lib/utils";
import type { WidgetConfig } from "@/lib/widget-config";

type DebuggableWindow = Window & {
  HeadlineTesterWidgetDebug?: boolean;
};

type WidgetRootProps = {
  initialReveal?: boolean;
  config: WidgetConfig;
};

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

export function WidgetRoot({ initialReveal = false, config }: WidgetRootProps) {
  const widgetToken = config.token;
  const [experiment, setExperiment] = useState(config.experiment);
  const experimentReady = Boolean(experiment?.variantHeadline);
  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const debuggableWindow = window as DebuggableWindow;
    if (debuggableWindow.HeadlineTesterWidgetDebug === true) {
      return true;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("debug") === "1" || params.get("hltDebug") === "1";
    } catch (_error) {
      return false;
    }
  }, []);
  const debugLog = useCallback(
    (label: string, payload?: unknown) => {
      if (!debugEnabled || typeof console === "undefined") {
        return;
      }
      if (typeof payload === "undefined") {
        console.info(`[HeadlineTester][widget] ${label}`);
      } else {
        console.info(`[HeadlineTester][widget] ${label}`, payload);
      }
    },
    [debugEnabled]
  );
  const [launcherVisible, setLauncherVisible] = useState(initialReveal);
  const [chatOpen, setChatOpen] = useState(initialReveal);
  const [headlineContext, setHeadlineContext] = useState<WidgetHeadlineContext>(
    {
      selector: null,
      text: null,
      originalText: null,
      found: false,
      path: config.experiment?.path ?? null,
      url: null,
    }
  );
  const [headlineStatus, setHeadlineStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [headlineError, setHeadlineError] = useState<string | null>(null);
  const [experimentStatus, setExperimentStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [experimentError, setExperimentError] = useState<string | null>(null);
  const [showHeadlineControls, setShowHeadlineControls] = useState(false);
  const [headlineEvents, setHeadlineEvents] = useState<WidgetHeadlineEvent[]>(
    []
  );
  const chatIdRef = useRef<string>();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pendingRequestIdRef = useRef<string | null>(null);
  const statusResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const headlineContextRef = useRef<WidgetHeadlineContext>(headlineContext);
  const hostPathRef = useRef<string | null>(config.experiment?.path ?? null);
  const hostUrlRef = useRef<string | null>(null);
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

  useEffect(() => {
    headlineContextRef.current = headlineContext;
  }, [headlineContext]);

  const enqueueHeadlineEvent = useCallback((event: WidgetHeadlineEvent) => {
    setHeadlineEvents((events) => [...events, event]);
  }, []);

  const handleHeadlineEventsConsumed = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      return;
    }
    setHeadlineEvents((events) =>
      events.filter((event) => !ids.includes(event.id))
    );
  }, []);

  const postMode = useCallback(
    (mode: "hidden" | "launcher" | "chat") => {
      debugLog("widget.mode.post", { experimentReady, mode });
      window.parent?.postMessage(
        { experimentReady, mode, type: MODE_EVENT },
        "*"
      );
    },
    [debugLog, experimentReady]
  );

  const showLauncher = useCallback(
    (openChat: boolean) => {
      debugLog("widget.launcher.show", { openChat });
      postMode(openChat ? "chat" : "launcher");
      setLauncherVisible(true);
      if (openChat) {
        setChatOpen(true);
      }
    },
    [debugLog, postMode]
  );

  const hideWidget = useCallback(() => {
    debugLog("widget.launcher.hide");
    postMode("hidden");
    setChatOpen(false);
    setLauncherVisible(false);
  }, [debugLog, postMode]);

  const handleLauncherClick = useCallback(() => {
    debugLog("widget.launcher.click");
    postMode("chat");
    setLauncherVisible(true);
    setChatOpen(true);
  }, [debugLog, postMode]);

  const handleClose = useCallback(() => {
    debugLog("widget.close");
    postMode("launcher");
    setLauncherVisible(true);
    setChatOpen(false);
  }, [debugLog, postMode]);

  const requestDomContext = useCallback(() => {
    debugLog("widget.requestDomContext");
    window.parent?.postMessage({ type: REQUEST_DOM_CONTEXT_EVENT }, "*");
  }, [debugLog]);

  const handleRewritePrompt = useCallback(
    (requestedHeadline?: string) => {
      const base =
        requestedHeadline?.trim() ??
        (headlineContext.text ?? headlineContext.originalText ?? "").trim();

      if (!base) {
        setHeadlineStatus("error");
        setHeadlineError("No headline available to rewrite yet.");
        return;
      }

      enqueueHeadlineEvent({
        id: generateUUID(),
        type: "rewrite-request",
        text: base,
        selector: headlineContext.selector ?? null,
      });
      debugLog("widget.rewrite.request", {
        selector: headlineContext.selector ?? null,
      });
      setHeadlineError(null);
      setHeadlineStatus((current) =>
        current === "pending" ? current : "idle"
      );
      setShowHeadlineControls(true);
    },
    [
      enqueueHeadlineEvent,
      headlineContext.originalText,
      headlineContext.selector,
      headlineContext.text,
      debugLog,
    ]
  );

  const applyHeadlineUpdate = useCallback(
    (nextHeadline: string) => {
      if (pendingRequestIdRef.current) {
        debugLog("widget.headline.apply.skip", { reason: "pending" });
        return;
      }

      const trimmed = nextHeadline.trim();
      if (!trimmed) {
        setHeadlineStatus("error");
        setHeadlineError("Headline cannot be empty.");
        debugLog("widget.headline.apply.error", { reason: "empty" });
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
      debugLog("widget.headline.apply.send", {
        requestId,
        selector: headlineContext.selector ?? null,
      });
      setExperimentStatus("idle");
      setExperimentError(null);
      window.parent?.postMessage(
        {
          type: UPDATE_HEADLINE_EVENT,
          text: trimmed,
          requestId,
        },
        "*"
      );
    },
    [debugLog, headlineContext.selector, headlineContext.text]
  );

  const resetHeadline = useCallback(() => {
    if (pendingRequestIdRef.current) {
      debugLog("widget.headline.reset.skip", { reason: "pending" });
      return;
    }

    if (!headlineContext.originalText) {
      setHeadlineStatus("error");
      setHeadlineError("No saved headline to restore.");
      debugLog("widget.headline.reset.error", { reason: "missing-original" });
      return;
    }

    const requestId = generateUUID();
    pendingRequestIdRef.current = requestId;
    setHeadlineStatus("pending");
    setHeadlineError(null);
    debugLog("widget.headline.reset.send", {
      requestId,
      selector: headlineContext.selector ?? null,
    });
    window.parent?.postMessage(
      {
        type: UPDATE_HEADLINE_EVENT,
        reset: true,
        requestId,
      },
      "*"
    );
    setExperimentStatus("idle");
    setExperimentError(null);
  }, [debugLog, headlineContext.originalText, headlineContext.selector]);

  const persistExperiment = useCallback(
    async ({
      action,
      selector,
      variantHeadline,
      controlHeadline,
      path,
    }: {
      action: "update" | "reset";
      selector: string | null;
      variantHeadline: string | null;
      controlHeadline: string | null;
      path: string | null;
    }) => {
      if (!config.controlToken) {
        debugLog("widget.experiment.persist.skip", {
          reason: "missing-control-token",
        });
        setExperimentStatus("error");
        const message =
          "Widget control token is not configured—persistence disabled.";
        setExperimentError(message);
        enqueueHeadlineEvent({
          id: generateUUID(),
          type: "experiment-error",
          message,
        });
        return;
      }

      const effectivePath =
        path ??
        hostPathRef.current ??
        headlineContext.path ??
        (typeof window !== "undefined" ? window.location.pathname : "/") ??
        "/";

      if (!effectivePath) {
        debugLog("widget.experiment.persist.skip", { reason: "missing-path" });
        return;
      }

      if (!controlHeadline) {
        debugLog("widget.experiment.persist.skip", {
          reason: "missing-control-headline",
        });
        return;
      }

      if (action === "update" && !variantHeadline) {
        debugLog("widget.experiment.persist.skip", {
          reason: "missing-variant-headline",
        });
        return;
      }

      if (typeof fetch !== "function") {
        debugLog("widget.experiment.persist.skip", { reason: "no-fetch" });
        return;
      }

      setExperimentStatus("saving");
      setExperimentError(null);

      try {
        const response = await fetch("/api/widget/experiments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.controlToken}`,
          },
          body: JSON.stringify({
            token: widgetToken,
            path: effectivePath,
            selector,
            controlHeadline,
            variantHeadline,
            action,
          }),
        });

        if (!response.ok) {
          let message = `Request failed with status ${response.status}`;
          try {
            const payload = await response.json();
            if (payload && typeof payload.message === "string") {
              message = payload.message;
            }
          } catch (_error) {
            // ignore parse errors
          }
          throw new Error(message);
        }

        const data = await response.json();
        const savedExperiment = data?.experiment ?? null;

        hostPathRef.current = savedExperiment?.path ?? effectivePath;

        if (savedExperiment) {
          setExperiment(savedExperiment);
        } else if (action === "reset") {
          setExperiment(null);
        }

        setExperimentStatus("success");
        setExperimentError(null);
        enqueueHeadlineEvent({
          id: generateUUID(),
          type: "experiment-saved",
          selector: savedExperiment?.selector ?? selector ?? null,
          path: savedExperiment?.path ?? effectivePath,
          controlHeadline:
            savedExperiment?.controlHeadline ?? controlHeadline ?? null,
          variantHeadline:
            savedExperiment?.variantHeadline ?? variantHeadline ?? null,
          status:
            savedExperiment?.status ??
            (action === "reset" ? "paused" : "draft"),
        });
        debugLog("widget.experiment.persist.success", {
          action,
          path: savedExperiment?.path ?? effectivePath,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save experiment.";
        setExperimentStatus("error");
        setExperimentError(message);
        enqueueHeadlineEvent({
          id: generateUUID(),
          type: "experiment-error",
          message,
        });
        debugLog("widget.experiment.persist.error", { message });
      }
    },
    [
      config.controlToken,
      debugLog,
      enqueueHeadlineEvent,
      headlineContext.path,
      widgetToken,
    ]
  );

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
          debugLog("widget.message.domContext", {
            found: typed.found !== false,
            selector: typed.selector ?? null,
          });
          setHeadlineContext((prev) => {
            const selector =
              typeof typed.selector === "string"
                ? typed.selector
                : prev.selector;
            const text =
              typeof typed.text === "string" ? typed.text : prev.text;
            const original =
              typeof typed.originalText === "string"
                ? typed.originalText
                : (prev.originalText ?? text ?? null);
            const found =
              typed.found === false ? false : Boolean(text ?? original);
            const path =
              typeof typed.path === "string"
                ? typed.path
                : (prev.path ?? hostPathRef.current ?? null);
            const url =
              typeof typed.url === "string"
                ? typed.url
                : (prev.url ?? hostUrlRef.current ?? null);

            if (typeof path === "string") {
              hostPathRef.current = path;
            }
            if (typeof typed.url === "string") {
              hostUrlRef.current = typed.url;
            }

            return {
              selector,
              text,
              originalText: original,
              found,
              path,
              url,
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
            const action = typed.action === "reset" ? "reset" : "update";
            const currentContext = headlineContextRef.current;
            const selectorFromMessage =
              typeof typed.selector === "string"
                ? typed.selector
                : currentContext.selector;
            const textFromMessage =
              typeof typed.text === "string" ? typed.text : currentContext.text;
            const controlHeadline =
              currentContext.originalText ?? currentContext.text ?? null;
            const pathFromMessage =
              typeof typed.path === "string"
                ? typed.path
                : (currentContext.path ?? hostPathRef.current ?? null);

            if (typeof typed.path === "string") {
              hostPathRef.current = typed.path;
            }

            debugLog("widget.message.headlineUpdated", {
              action,
              selector: selectorFromMessage ?? null,
              path: pathFromMessage ?? null,
            });
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
              const path =
                typeof typed.path === "string"
                  ? typed.path
                  : (prev.path ?? hostPathRef.current ?? null);
              const url = prev.url ?? hostUrlRef.current ?? null;
              enqueueHeadlineEvent({
                id: generateUUID(),
                type: "applied",
                action,
                text,
                selector: selector ?? null,
              });
              return {
                selector,
                text,
                originalText: original,
                found: true,
                path,
                url,
              };
            });
            persistExperiment({
              action,
              selector: selectorFromMessage ?? null,
              variantHeadline:
                action === "reset" ? null : (textFromMessage ?? null),
              controlHeadline,
              path: pathFromMessage,
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
            setExperimentStatus("error");
            setExperimentError(reason);
            enqueueHeadlineEvent({
              id: generateUUID(),
              type: "experiment-error",
              message: reason,
            });
            debugLog("widget.message.headlineUpdated", {
              action: typed.action === "reset" ? "reset" : "update",
              reason,
              status: "error",
            });
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
        debugLog("widget.message.show", { shouldOpen });
        showLauncher(shouldOpen);
      } else if (message.type === HIDE_EVENT) {
        debugLog("widget.message.hide");
        hideWidget();
      }
    };

    window.addEventListener("message", handleMessage);
    const initialMode = initialReveal ? "chat" : "hidden";
    debugLog("widget.ready", {
      experimentReady,
      initialMode,
      siteName: config.siteName,
      token: widgetToken,
    });
    window.parent?.postMessage(
      {
        experimentReady,
        mode: initialMode,
        siteName: config.siteName,
        token: widgetToken,
        type: READY_EVENT,
      },
      "*"
    );
    requestDomContext();

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    config.siteName,
    debugLog,
    enqueueHeadlineEvent,
    experimentReady,
    hideWidget,
    initialReveal,
    persistExperiment,
    requestDomContext,
    showLauncher,
    widgetToken,
  ]);

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

  const headlineControls = useMemo<WidgetHeadlineControlsProps>(
    () => ({
      context: headlineContext,
      status: headlineStatus,
      error: headlineError,
      isPending: headlineStatus === "pending" || experimentStatus === "saving",
      experimentStatus,
      experimentError,
      onApply: applyHeadlineUpdate,
      onReset: resetHeadline,
      onRewrite: handleRewritePrompt,
    }),
    [
      headlineContext,
      headlineStatus,
      headlineError,
      experimentStatus,
      experimentError,
      applyHeadlineUpdate,
      resetHeadline,
      handleRewritePrompt,
    ]
  );

  const handleStartHeadlineTest = useCallback(() => {
    setShowHeadlineControls(true);
  }, []);

  useEffect(() => {
    if (headlineStatus !== "idle" && !showHeadlineControls) {
      setShowHeadlineControls(true);
    }
  }, [headlineStatus, showHeadlineControls]);

  const widgetHeadlineStarter = useMemo(
    () => ({
      showControls: showHeadlineControls,
      onStart: handleStartHeadlineTest,
      controls: headlineControls,
      onRewrite: () => handleRewritePrompt(),
      canRewrite:
        experimentStatus !== "saving" &&
        Boolean(
          (headlineContext.text ?? headlineContext.originalText ?? "").trim()
        ),
    }),
    [
      showHeadlineControls,
      handleStartHeadlineTest,
      headlineControls,
      handleRewritePrompt,
      headlineContext.text,
      headlineContext.originalText,
      experimentStatus,
    ]
  );

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
            <div className="min-h-0 flex-1">
              <Chat
                autoResume={false}
                id={chatId}
                initialChatModel={DEFAULT_CHAT_MODEL}
                initialMessages={[]}
                initialVisibilityType="private"
                isReadonly={false}
                isWidget
                key={chatId}
                onWidgetHeadlineEventsConsumed={handleHeadlineEventsConsumed}
                widgetConfig={config}
                widgetHeadlineEvents={headlineEvents}
                widgetHeadlineStarter={widgetHeadlineStarter}
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
