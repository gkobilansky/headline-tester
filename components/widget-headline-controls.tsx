"use client";

import { CheckIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type WidgetHeadlineContext = {
  selector: string | null;
  text: string | null;
  originalText: string | null;
  found: boolean;
};

export type WidgetHeadlineControlsProps = {
  context: WidgetHeadlineContext;
  status: "idle" | "pending" | "success" | "error";
  error: string | null;
  isPending: boolean;
  onApply: (nextHeadline: string) => void;
  onReset: () => void;
};

export function WidgetHeadlineControls({
  context,
  status,
  error,
  isPending,
  onApply,
  onReset,
}: WidgetHeadlineControlsProps) {
  const canonicalHeadline = context.text ?? context.originalText ?? "";
  const [draft, setDraft] = useState(canonicalHeadline);

  useEffect(() => {
    setDraft(canonicalHeadline);
  }, [canonicalHeadline]);

  const trimmedDraft = draft.trim();
  const trimmedCanonical = canonicalHeadline.trim();

  const isDirty = trimmedDraft !== trimmedCanonical;
  const canApply =
    context.found && isDirty && trimmedDraft.length > 0 && !isPending;
  const canReset = Boolean(
    context.originalText &&
      context.originalText.trim() !== trimmedCanonical &&
      !isPending
  );

  const statusIndicator = useMemo(() => {
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          Updating…
        </span>
      );
    }

    if (status === "success") {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-500 text-xs">
          <CheckIcon aria-hidden="true" className="h-3.5 w-3.5" />
          Updated
        </span>
      );
    }

    return null;
  }, [status]);

  const helperMessage = useMemo(() => {
    if (error) {
      return {
        text: error,
        className: "text-destructive",
      };
    }

    if (!context.found) {
      return {
        text: 'No headline detected. Add data-headlinetester-target="headline" to your markup.',
        className: "text-muted-foreground",
      };
    }

    if (status === "success") {
      return {
        text: "Headline updated on the demo page.",
        className: "text-emerald-500",
      };
    }

    if (isDirty) {
      return {
        text: "Edit complete—apply to push this copy to the demo page.",
        className: "text-muted-foreground",
      };
    }

    return {
      text: "Adjust the copy and apply to see changes instantly.",
      className: "text-muted-foreground",
    };
  }, [context.found, error, isDirty, status]);

  return (
    <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground text-sm">
            Demo page headline
          </p>
          <p className="text-muted-foreground text-xs">
            {context.selector
              ? `Target ${context.selector}`
              : "Waiting for embed context…"}
          </p>
        </div>

        {statusIndicator}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <Textarea
          autoComplete="off"
          autoCorrect="on"
          className={cn(
            "h-24 resize-none rounded-lg border-border bg-background/90 text-sm shadow-inner transition focus-visible:ring-1 focus-visible:ring-ring",
            (!context.found || isPending) && "opacity-60"
          )}
          disabled={!context.found || isPending}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Headline copy will appear here once detected."
          spellCheck
          value={draft}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            className={cn(
              "text-xs leading-tight",
              helperMessage.className,
              isPending && "italic"
            )}
          >
            {helperMessage.text}
          </span>

          <div className="flex items-center gap-2">
            <Button
              disabled={!canReset}
              onClick={onReset}
              size="sm"
              type="button"
              variant="ghost"
            >
              Reset
            </Button>
            <Button
              disabled={!canApply}
              onClick={() => onApply(draft)}
              size="sm"
              type="button"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
