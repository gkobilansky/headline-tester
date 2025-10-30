const SAFE_SELECTOR_CHAR = /[a-zA-Z0-9_-]/;

(() => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const READY_EVENT = "headlineTester:ready";
  const SHOW_EVENT = "headlineTester:show";
  const HIDE_EVENT = "headlineTester:hide";
  const MODE_EVENT = "headlineTester:mode";
  const DIMENSIONS_EVENT = "headlineTester:dimensions";
  const DOM_CONTEXT_EVENT = "headlineTester:domContext";
  const UPDATE_HEADLINE_EVENT = "headlineTester:updateHeadline";
  const HEADLINE_UPDATED_EVENT = "headlineTester:headlineUpdated";
  const REQUEST_DOM_CONTEXT_EVENT = "headlineTester:requestDomContext";
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
  /*
   * Loader <-> iframe postMessage contract:
   * - READY_EVENT: iframe boot complete; includes { token, siteName, mode, experimentReady }.
   * - MODE_EVENT: iframe visibility changed; carries { mode, experimentReady }.
   * - DIMENSIONS_EVENT: iframe surface resized; provides { width, height }.
   * - DOM_CONTEXT_EVENT: loader sends current headline selection + copy to the iframe.
   * - UPDATE_HEADLINE_EVENT: iframe requests headline mutation on the host page.
   */

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

  const scriptDebugAttr = currentScript?.getAttribute("data-debug");
  const scriptDebugEnabled =
    typeof scriptDebugAttr === "string"
      ? scriptDebugAttr === "" || scriptDebugAttr.toLowerCase() === "true"
      : false;
  let searchDebugEnabled = false;
  try {
    const params = new URLSearchParams(window.location.search);
    searchDebugEnabled = params.get("hltDebug") === "1";
  } catch (_error) {
    searchDebugEnabled = false;
  }

  function isDebugEnabled() {
    if (scriptDebugEnabled || searchDebugEnabled) {
      return true;
    }
    return window.HeadlineTesterWidgetDebug === true;
  }

  function debugLog(label, detail) {
    if (!isDebugEnabled() || typeof console === "undefined") {
      return;
    }
    if (typeof detail === "undefined") {
      console.info(`[HeadlineTester][loader] ${label}`);
    } else {
      console.info(`[HeadlineTester][loader] ${label}`, detail);
    }
  }

  let token = currentScript?.getAttribute("data-token") || "";
  token = token?.trim() ? token.trim() : DEFAULT_TOKEN;
  debugLog("loader.init", {
    token,
    scriptSrc: currentScript?.src ?? null,
  });

  const scriptUrl =
    (currentScript?.src && new URL(currentScript.src, window.location.href)) ||
    null;
  const widgetUrl = new URL(
    "/widget",
    scriptUrl ? scriptUrl.origin : window.location.origin
  );
  const hostPath =
    typeof window.location.pathname === "string" &&
    window.location.pathname.length > 0
      ? window.location.pathname
      : "/";
  const hostUrl =
    typeof window.location.href === "string" && window.location.href.length > 0
      ? window.location.href
      : null;
  if (token) {
    widgetUrl.searchParams.set("token", token);
  }
  if (hostPath) {
    widgetUrl.searchParams.set("path", hostPath);
  }
  debugLog("loader.widgetUrl", { url: widgetUrl.toString() });

  let container = null;
  let frame = null;
  let ready = false;
  const queue = [];
  const targetOrigin = widgetUrl.origin;
  let requestedReveal = false;
  let currentMode = MODE_HIDDEN;
  let measuredDimensions = null;
  let headlineElement = null;
  let originalHeadlineText = null;
  let headlineSelector = null;
  let latestHeadlineText = null;
  let experimentReady = false;
  let iframeToken = null;
  let iframeSiteName = null;

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
      debugLog("loader.frame.mount", { src: frame.src });
    }

    return frame;
  }

  function postMessage(payload) {
    if (!frame || !frame.contentWindow) {
      return;
    }
    frame.contentWindow.postMessage(payload, targetOrigin);
    debugLog("loader.postMessage", payload);
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
    debugLog("loader.container.resize", {
      height,
      mode: currentMode,
      width,
    });
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
    debugLog("loader.mode.set", { mode: currentMode });
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
    debugLog("loader.visibility", { visible });
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

  const cssEscape =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? (value) => CSS.escape(value)
      : (value) =>
          String(value)
            .split("")
            .map((char) =>
              SAFE_SELECTOR_CHAR.test(char)
                ? char
                : `\\${char.charCodeAt(0).toString(16)} `
            )
            .join("");

  function runWhenDomReady(callback) {
    if (typeof callback !== "function") {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          callback();
        },
        { once: true }
      );
    } else {
      callback();
    }
  }

  function deriveHeadlineSelector(target) {
    if (!target) {
      return headlineSelector || null;
    }

    const dataAttr = target.getAttribute("data-headlinetester-target");
    if (dataAttr) {
      return `[data-headlinetester-target="${dataAttr}"]`;
    }

    if (target.id) {
      return `#${cssEscape(target.id)}`;
    }

    const tagName = target.tagName ? target.tagName.toLowerCase() : null;
    if (tagName) {
      return tagName;
    }

    return headlineSelector || "h1";
  }

  function findHeadlineElement() {
    if (headlineElement && document.contains(headlineElement)) {
      return headlineElement;
    }

    headlineElement = document.querySelector(
      '[data-headlinetester-target="headline"]'
    );

    if (!headlineElement) {
      headlineElement = document.querySelector("h1");
    }

    if (headlineElement) {
      if (originalHeadlineText === null) {
        originalHeadlineText = headlineElement.textContent || "";
      }
      if (!headlineSelector) {
        headlineSelector = deriveHeadlineSelector(headlineElement);
      }
      latestHeadlineText = headlineElement.textContent || "";
      return headlineElement;
    }

    return null;
  }

  function buildHeadlineContext() {
    const target = findHeadlineElement();
    if (!target) {
      return {
        type: DOM_CONTEXT_EVENT,
        path: hostPath,
        url: hostUrl,
        selector: headlineSelector,
        text: null,
        originalText: originalHeadlineText,
        found: false,
      };
    }

    latestHeadlineText = target.textContent || "";
    return {
      type: DOM_CONTEXT_EVENT,
      path: hostPath,
      url: hostUrl,
      selector: deriveHeadlineSelector(target),
      text: latestHeadlineText,
      originalText:
        originalHeadlineText !== null
          ? originalHeadlineText
          : latestHeadlineText,
      found: true,
    };
  }

  function sendHeadlineContext() {
    const context = buildHeadlineContext();
    debugLog("loader.domContext.send", {
      found: context.found,
      selector: context.selector,
      text: context.text,
    });
    enqueue(context);
  }

  function handleUpdateHeadlineMessage(data) {
    const requestId =
      data && typeof data.requestId === "string" ? data.requestId : undefined;

    const target = findHeadlineElement();
    if (!target) {
      debugLog("loader.domUpdate.error", {
        reason: "not-found",
      });
      postMessage({
        type: HEADLINE_UPDATED_EVENT,
        status: "error",
        reason: "not-found",
        requestId,
        path: hostPath,
      });
      return;
    }

    const wantsReset = data && data.reset === true;
    const nextText =
      wantsReset && originalHeadlineText !== null
        ? originalHeadlineText
        : typeof data?.text === "string"
          ? data.text
          : undefined;

    if (nextText === undefined) {
      debugLog("loader.domUpdate.error", {
        reason: "invalid-payload",
      });
      postMessage({
        type: HEADLINE_UPDATED_EVENT,
        status: "error",
        reason: "invalid-payload",
        requestId,
        path: hostPath,
      });
      return;
    }

    target.textContent = nextText;
    latestHeadlineText = target.textContent || "";
    debugLog("loader.domUpdate.success", {
      action: wantsReset ? "reset" : "update",
      selector: deriveHeadlineSelector(target),
      text: latestHeadlineText,
    });

    postMessage({
      type: HEADLINE_UPDATED_EVENT,
      status: "success",
      selector: deriveHeadlineSelector(target),
      text: latestHeadlineText,
      requestId,
      action: wantsReset ? "reset" : "update",
      path: hostPath,
    });

    enqueue({
      type: DOM_CONTEXT_EVENT,
      path: hostPath,
      url: hostUrl,
      selector: deriveHeadlineSelector(target),
      text: latestHeadlineText,
      originalText:
        originalHeadlineText !== null
          ? originalHeadlineText
          : latestHeadlineText,
      found: true,
    });
  }

  function autoRevealIfNeeded() {
    if (requestedReveal) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const flag = params.get("hlt");
    if (flag === "1") {
      requestedReveal = true;
      debugLog("loader.autoReveal", { mode: "chat" });
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
      debugLog("loader.message.ready", {
        experimentReady: data.experimentReady ?? null,
        mode: data.mode ?? null,
        siteName: data.siteName ?? null,
        token: data.token ?? null,
      });
      if (typeof data.token === "string") {
        iframeToken = data.token;
      }
      if (typeof data.siteName === "string") {
        iframeSiteName = data.siteName;
      }
      if (typeof data.experimentReady === "boolean") {
        experimentReady = data.experimentReady;
      }
      ready = true;
      api[READY_ATTRIBUTE] = true;
      if (typeof data.mode === "string") {
        setMode(data.mode);
      }
      updateContainerSize();
      flushQueue();
      autoRevealIfNeeded();
      runWhenDomReady(() => {
        sendHeadlineContext();
      });
      return;
    }

    if (data.type === MODE_EVENT) {
      const mode = data.mode;
      if (typeof data.experimentReady === "boolean") {
        experimentReady = data.experimentReady;
      }
      debugLog("loader.message.mode", {
        experimentReady,
        mode,
      });
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
      debugLog("loader.message.dimensions", {
        height: data.height ?? null,
        width: data.width ?? null,
      });
      handleDimensionsMessage(data);
      return;
    }

    if (data.type === UPDATE_HEADLINE_EVENT) {
      debugLog("loader.message.updateHeadline", {
        reset: data.reset === true,
        text: typeof data.text === "string" ? data.text : null,
      });
      runWhenDomReady(() => {
        handleUpdateHeadlineMessage(data);
      });
      return;
    }

    if (data.type === REQUEST_DOM_CONTEXT_EVENT) {
      debugLog("loader.message.requestDomContext", {});
      runWhenDomReady(() => {
        sendHeadlineContext();
      });
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
    debugLog("loader.api.show", { open: normalized.open === true });
    setMode(normalized.open ? MODE_CHAT : MODE_LAUNCHER);
    setVisible(true);
    enqueue(
      normalized.open ? { type: SHOW_EVENT, open: true } : { type: SHOW_EVENT }
    );
    return api;
  };
  api.hide = () => {
    requestedReveal = false;
    debugLog("loader.api.hide");
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
  Object.defineProperty(api, "experimentReady", {
    configurable: false,
    enumerable: true,
    get() {
      return experimentReady;
    },
  });
  Object.defineProperty(api, "token", {
    configurable: false,
    enumerable: true,
    get() {
      return iframeToken || token;
    },
  });
  Object.defineProperty(api, "siteName", {
    configurable: false,
    enumerable: true,
    get() {
      return iframeSiteName || null;
    },
  });

  window[GLOBAL_NAME] = api;

  window.addEventListener("message", handleMessage);
  mountWhenReady();
})();
