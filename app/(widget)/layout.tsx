import type { ReactNode } from "react";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { WidgetBodyClass } from "@/components/widget-body-class";

export default function WidgetLayout({ children }: { children: ReactNode }) {
  return (
    <DataStreamProvider>
      <WidgetBodyClass />
      <div
        className="flex min-h-full flex-col bg-transparent text-foreground"
        data-widget-root="true"
      >
        {children}
      </div>
    </DataStreamProvider>
  );
}
