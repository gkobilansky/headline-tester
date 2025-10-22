"use client";

import { useEffect } from "react";

export function WidgetBodyClass() {
  useEffect(() => {
    const { body } = document;

    if (!body) {
      return;
    }

    body.classList.add("widget-body");

    return () => {
      body.classList.remove("widget-body");
    };
  }, []);

  return null;
}
