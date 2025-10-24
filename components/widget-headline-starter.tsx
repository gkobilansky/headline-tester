"use client";

import { motion } from "framer-motion";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WidgetHeadlineControls,
  type WidgetHeadlineControlsProps,
} from "@/components/widget-headline-controls";

export type WidgetHeadlineStarterConfig = {
  showControls: boolean;
  onStart: () => void;
  controls: WidgetHeadlineControlsProps;
  onRewrite?: () => void;
  canRewrite?: boolean;
};

type WidgetHeadlineStarterProps = WidgetHeadlineStarterConfig;

export function WidgetHeadlineStarter({
  showControls,
  onStart,
  controls,
  onRewrite,
  canRewrite = true,
}: WidgetHeadlineStarterProps) {
  if (showControls) {
    return (
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        <WidgetHeadlineControls {...controls} />
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2">
          <Button
            className="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/60 px-4 py-3 text-left font-medium text-foreground text-sm shadow-sm transition hover:bg-accent"
            onClick={onStart}
            type="button"
            variant="ghost"
          >
            <span>I want to start a new headline test</span>
            <ChevronRightIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Button>
          {onRewrite ? (
            <Button
              className="inline-flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-border/50 bg-background/40 px-4 py-3 text-left font-medium text-foreground text-sm shadow-sm transition hover:bg-accent"
              disabled={!canRewrite}
              onClick={onRewrite}
              type="button"
              variant="outline"
            >
              <span>Ask the assistant to rewrite this headline</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="h-4 w-4 shrink-0"
              />
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
