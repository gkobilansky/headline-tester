(() => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const READY_EVENT = "headlineTester:ready";
  const SHOW_EVENT = "headlineTester:show";
  const HIDE_EVENT = "headlineTester:hide";
  const MODE_EVENT = "headlineTester:mode";
  const DIMENSIONS_EVENT = "headlineTester:dimensions";
  const GLOBAL_NAME = "HeadlineTesterWidget";
  const CONTAINER_ID = "headline-tester-widget-container";
  const IFRAME_ID = "headline-tester-widget-iframe";
  const DEFAULT_TOKEN = "demo";
  const READY_ATTRIBUTE = "__headlineTesterWidgetReady";
  const LOADER_FLAG = "__headlineTesterWidgetLoader";
  const COLLAPSED_WIDTH = 72;
  const COLLAPSED_HEIGHT = 72;
  const EXPANDED_WIDTH = 400;
  const EXPANDED_HEIGHT = 640;
  const COLLAPSED_MIN_WIDTH = 64;
  const COLLAPSED_MIN_HEIGHT = 64;
  const EXPANDED_MIN_WIDTH = 320;
  const EXPANDED_MIN_HEIGHT = 400;
  const MODE_HIDDEN = "hidden";
  const MODE_LAUNCHER = "launcher";
  const MODE_CHAT = "chat";
  const CHAT_BOX_SHADOW = "0 24px 70px rgba(15,23,42,0.35)";
  const LAUNCHER_BOX_SHADOW = "0 18px 45px rgba(37,99,235,0.35)";

  if (window[LOADER_FLAG]) {
    return;
  }
  window[LOADER_FLAG] = true;

  const currentScript =
    document.currentScript ||
    (() => {
      const scripts = document.getElementsByTagName("script");
      return scripts.at(-1) || null;
    })();

  let token = currentScript?.getAttribute("data-token") || "";
  token = token?.trim() ? token.trim() : DEFAULT_TOKEN;

  const scriptUrl =
    (currentScript?.src && new URL(currentScript.src, window.location.href)) ||
    null;
  const widgetUrl = new URL(
    "/widget",
    scriptUrl ? scriptUrl.origin : window.location.origin
  );
  if (token) {
    widgetUrl.searchParams.set("token", token);
  }

  let container = null;
  let frame = null;
  let ready = false;
  const queue = [];
  const targetOrigin = widgetUrl.origin;
  let requestedReveal = false;
  let currentMode = MODE_HIDDEN;
  let measuredDimensions = null;

  function ensureContainer() {
    if (container?.parentNode) {
      return container;
    }

    container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement("div");
      container.id = CONTAINER_ID;
      container.style.position = "fixed";
      container.style.bottom = "24px";
      container.style.right = "24px";
      container.style.zIndex = "2147483000";
      container.style.display = "none";
      container.style.pointerEvents = "none";
      container.style.width = `${COLLAPSED_WIDTH}px`;
      container.style.maxWidth = "calc(100vw - 48px)";
      container.style.height = `${COLLAPSED_HEIGHT}px`;
      container.style.maxHeight = "calc(100vh - 48px)";
      container.style.background = "transparent";
    }

    if (!container.parentNode && document.body) {
      document.body.appendChild(container);
    }

    return container;
  }

  function ensureFrame() {
    if (frame?.parentNode) {
      return frame;
    }

    const root = ensureContainer();
    frame = document.getElementById(IFRAME_ID);
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = IFRAME_ID;
      frame.allow = "clipboard-write";
      frame.title = "Headline Tester Widget";
      frame.style.width = "100%";
      frame.style.height = "100%";
      frame.style.border = "0";
      frame.style.borderRadius = "inherit";
      frame.style.boxShadow = "none";
      frame.style.background = "transparent";
    }

    if (!frame.parentNode) {
      root.appendChild(frame);
    }

    if (!frame.src) {
      frame.src = widgetUrl.toString();
    }

    return frame;
  }

  function postMessage(payload) {
    if (!frame || !frame.contentWindow) {
      return;
    }
    frame.contentWindow.postMessage(payload, targetOrigin);
  }

  function enqueue(payload) {
    if (ready) {
      postMessage(payload);
    } else {
      queue.push(payload);
    }
  }

  function flushQueue() {
    if (!ready) {
      return;
    }

    while (queue.length > 0) {
      const payload = queue.shift();
      postMessage(payload);
    }
  }

  function clampSize(value, minimum) {
    if (typeof value !== "number" || value <= 0) {
      return minimum;
    }
    return Math.max(value, minimum);
  }

  function updateContainerSize() {
    const root = ensureContainer();
    if (!root) {
      return;
    }

    const fallbackWidth =
      currentMode === MODE_CHAT ? EXPANDED_WIDTH : COLLAPSED_WIDTH;
    const fallbackHeight =
      currentMode === MODE_CHAT ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;
    const minWidth =
      currentMode === MODE_CHAT ? EXPANDED_MIN_WIDTH : COLLAPSED_MIN_WIDTH;
    const minHeight =
      currentMode === MODE_CHAT ? EXPANDED_MIN_HEIGHT : COLLAPSED_MIN_HEIGHT;

    let width = clampSize(fallbackWidth, minWidth);
    let height = clampSize(fallbackHeight, minHeight);

    if (measuredDimensions) {
      if (typeof measuredDimensions.width === "number") {
        width = clampSize(measuredDimensions.width, minWidth);
      }
      if (typeof measuredDimensions.height === "number") {
        height = clampSize(measuredDimensions.height, minHeight);
      }
    }

    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    root.style.maxWidth = "calc(100vw - 48px)";
    root.style.maxHeight = "calc(100vh - 48px)";
  }

  function applyModeStyles() {
    const root = ensureContainer();
    if (!root) {
      return;
    }

    if (currentMode === MODE_CHAT) {
      root.style.borderRadius = "20px";
      root.style.boxShadow = CHAT_BOX_SHADOW;
      root.style.overflow = "hidden";
    } else if (currentMode === MODE_LAUNCHER) {
      root.style.borderRadius = "9999px";
      root.style.boxShadow = LAUNCHER_BOX_SHADOW;
      root.style.overflow = "visible";
    } else {
      root.style.borderRadius = "9999px";
      root.style.boxShadow = "none";
      root.style.overflow = "hidden";
    }
  }

  function setMode(mode) {
    if (mode !== MODE_CHAT && mode !== MODE_LAUNCHER && mode !== MODE_HIDDEN) {
      return;
    }

    currentMode = mode;
    applyModeStyles();
    updateContainerSize();
  }

  function handleDimensionsMessage(data) {
    const width = typeof data.width === "number" ? data.width : null;
    const height = typeof data.height === "number" ? data.height : null;

    if (width === null && height === null) {
      return;
    }

    measuredDimensions = {
      width,
      height,
    };

    updateContainerSize();
  }

  function setVisible(visible) {
    const root = ensureContainer();
    if (!root) {
      return;
    }

    root.style.display = visible ? "block" : "none";
    root.style.pointerEvents = visible ? "auto" : "none";
    if (visible) {
      applyModeStyles();
      updateContainerSize();
    }
  }

  function normaliseShowOptions(options) {
    if (options === undefined) {
      return {};
    }

    if (typeof options === "boolean") {
      return { open: options };
    }

    if (options && typeof options === "object") {
      return { open: options.open === true };
    }

    return {};
  }

  function autoRevealIfNeeded() {
    if (requestedReveal) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const flag = params.get("hlt");
    if (flag === "1") {
      requestedReveal = true;
      api.show();
    }
  }

  function handleMessage(event) {
    if (!frame || event.source !== frame.contentWindow) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }

    if (data.type === READY_EVENT) {
      ready = true;
      api[READY_ATTRIBUTE] = true;
      updateContainerSize();
      flushQueue();
      autoRevealIfNeeded();
      return;
    }

    if (data.type === MODE_EVENT) {
      const mode = data.mode;
      if (
        mode === MODE_CHAT ||
        mode === MODE_LAUNCHER ||
        mode === MODE_HIDDEN
      ) {
        setMode(mode);
      }
      return;
    }

    if (data.type === DIMENSIONS_EVENT) {
      handleDimensionsMessage(data);
      return;
    }
  }

  function mountWhenReady() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount, { once: true });
    } else {
      mount();
    }
  }

  function mount() {
    ensureFrame();
  }

  const api = window[GLOBAL_NAME] || {};
  api.show = (options) => {
    mountWhenReady();
    const normalized = normaliseShowOptions(options);
    requestedReveal = true;
    setMode(normalized.open ? MODE_CHAT : MODE_LAUNCHER);
    setVisible(true);
    enqueue(
      normalized.open ? { type: SHOW_EVENT, open: true } : { type: SHOW_EVENT }
    );
    return api;
  };
  api.hide = () => {
    requestedReveal = false;
    enqueue({ type: HIDE_EVENT });
    setMode(MODE_HIDDEN);
    setVisible(false);
    return api;
  };

  Object.defineProperty(api, "ready", {
    configurable: false,
    enumerable: true,
    get() {
      return ready;
    },
  });

  window[GLOBAL_NAME] = api;

  window.addEventListener("message", handleMessage);
  mountWhenReady();
})();
