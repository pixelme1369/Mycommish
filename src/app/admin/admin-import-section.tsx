"use client";

import { useState } from "react";
import { CrmUploadForm } from "./crm-upload-form";
import { CordobaUploadForm } from "./cordoba-upload-form";
import { HistoryUploadForm } from "./history-upload-form";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AdminImportSection() {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl tracking-tight">Import</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            History (optional) → CRM → Cordoba
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {open ? "Hide uploads" : "Show uploads"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="glass-panel p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              1 · History
            </p>
            <div className="mt-3">
              <HistoryUploadForm />
            </div>
          </Card>
          <Card className="glass-panel p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              2 · CRM
            </p>
            <div className="mt-3">
              <CrmUploadForm />
            </div>
          </Card>
          <Card className="glass-panel p-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              3 · Cordoba
            </p>
            <div className="mt-3">
              <CordobaUploadForm />
            </div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
