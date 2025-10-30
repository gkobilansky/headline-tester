import { z } from "zod";
import { getWidgetConfig, upsertWidgetExperiment } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { normalizeWidgetPath, normalizeWidgetToken } from "@/lib/widget-config";

const widgetExperimentPayloadSchema = z
  .object({
    token: z.string(),
    path: z.string(),
    selector: z.string().nullish(),
    controlHeadline: z.string(),
    variantHeadline: z.string().nullish(),
    status: z.enum(["draft", "active", "paused"]).optional(),
    action: z.enum(["update", "reset"]).default("update"),
    authorLabel: z.string().nullish(),
  })
  .superRefine((payload, ctx) => {
    if (
      payload.action === "update" &&
      (typeof payload.variantHeadline !== "string" ||
        !payload.variantHeadline.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "variantHeadline is required when action is update.",
        path: ["variantHeadline"],
      });
    }
  });

function extractControlToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function POST(request: Request) {
  let payload: z.infer<typeof widgetExperimentPayloadSchema>;

  try {
    const json = await request.json();
    payload = widgetExperimentPayloadSchema.parse(json);
  } catch (_error) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const controlToken = extractControlToken(request);
  if (!controlToken) {
    return new ChatSDKError(
      "unauthorized:api",
      "Missing widget control token."
    ).toResponse();
  }

  const widgetToken = normalizeWidgetToken(payload.token);
  const widgetPath = normalizeWidgetPath(payload.path);

  if (!widgetToken || !widgetPath) {
    return new ChatSDKError(
      "bad_request:api",
      "Invalid widget token or path."
    ).toResponse();
  }

  const widgetConfig = await getWidgetConfig(widgetToken);
  if (!widgetConfig) {
    return new ChatSDKError(
      "not_found:api",
      "Widget configuration not found."
    ).toResponse();
  }

  if (!widgetConfig.controlToken) {
    return new ChatSDKError(
      "forbidden:api",
      "Widget control token is not configured."
    ).toResponse();
  }

  if (widgetConfig.controlToken !== controlToken) {
    return new ChatSDKError(
      "forbidden:api",
      "Invalid widget control token."
    ).toResponse();
  }

  const controlHeadline = payload.controlHeadline.trim();
  if (!controlHeadline) {
    return new ChatSDKError(
      "bad_request:api",
      "Control headline is required."
    ).toResponse();
  }
  const normalizedSelector =
    typeof payload.selector === "string" && payload.selector.trim().length > 0
      ? payload.selector.trim()
      : null;
  const variantHeadline =
    payload.action === "reset"
      ? null
      : typeof payload.variantHeadline === "string"
        ? payload.variantHeadline.trim()
        : null;

  if (payload.action === "update" && !variantHeadline) {
    return new ChatSDKError(
      "bad_request:api",
      "Variant headline is required."
    ).toResponse();
  }

  const status =
    payload.status ?? (payload.action === "reset" ? "paused" : "draft");

  try {
    const experiment = await upsertWidgetExperiment({
      token: widgetToken,
      path: widgetPath,
      selector: normalizedSelector,
      controlHeadline,
      variantHeadline,
      status,
      authorLabel:
        typeof payload.authorLabel === "string"
          ? payload.authorLabel.trim()
          : null,
    });

    return Response.json({ experiment }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Unable to save widget experiment."
    ).toResponse();
  }
}
