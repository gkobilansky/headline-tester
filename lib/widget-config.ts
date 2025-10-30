export type WidgetExperimentSnapshot = {
  id: string;
  path: string;
  status: "draft" | "active" | "paused";
  selector: string | null;
  controlHeadline: string | null;
  variantHeadline: string | null;
  authorLabel: string | null;
  updatedAt: string;
};

export type WidgetConfig = {
  token: string;
  siteName: string;
  siteUrl?: string | null;
  status: "active" | "disabled";
  controlToken: string | null;
  experiment: WidgetExperimentSnapshot | null;
};

export const demoWidgetConfig: WidgetConfig = {
  token: "demo",
  siteName: "Demo Workspace",
  siteUrl: "http://localhost:3001",
  status: "active",
  controlToken: "demo-control-token",
  experiment: null,
};

export function normalizeWidgetToken(
  token?: string | string[] | null
): string | null {
  if (typeof token === "string") {
    const trimmed = token.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(token)) {
    const candidate = token.find(
      (value) => typeof value === "string" && value.trim().length > 0
    );
    return candidate ? candidate.trim() : null;
  }

  return null;
}

export function normalizeWidgetPath(
  path?: string | string[] | null
): string | null {
  const candidate =
    typeof path === "string"
      ? path
      : Array.isArray(path)
        ? path.find((value) => typeof value === "string")
        : null;

  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed, "http://localhost");
    return url.pathname || "/";
  } catch (_error) {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}
