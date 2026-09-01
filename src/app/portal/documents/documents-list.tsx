"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanyDocSignDialog } from "./sign-dialog";
import type { PortalDocumentItem } from "@/lib/portal/signed-documents";

function formatWhen(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DocumentRow({
  item,
  onSign,
}: {
  item: PortalDocumentItem;
  onSign: (item: PortalDocumentItem) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.kind === "statement" ? "Commission statement" : "Company document"}
          {item.signedAt ? ` · signed ${formatWhen(item.signedAt)}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.status === "signed" ? "secondary" : "outline"}>
          {item.status === "signed" ? "Signed" : "Pending"}
        </Badge>
        {item.viewHref ? (
          <a
            href={item.viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-sm hover:bg-muted"
          >
            View
          </a>
        ) : null}
        {item.status === "pending" && item.kind === "company" ? (
          <Button type="button" size="sm" className="h-8" onClick={() => onSign(item)}>
            Sign
          </Button>
        ) : null}
        {item.status === "pending" && item.signHref ? (
          <Link
            href={item.signHref}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Sign
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function SignedDocumentsList({
  pending,
  signed,
  lockedName,
}: {
  pending: PortalDocumentItem[];
  signed: PortalDocumentItem[];
  lockedName: string;
}) {
  const [signing, setSigning] = useState<PortalDocumentItem | null>(null);

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="font-heading text-base tracking-tight">Pending</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Needs your signature
        </p>
        {pending.length === 0 ? (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            Nothing waiting to sign.
          </Card>
        ) : (
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul>
              {pending.map((item) => (
                <DocumentRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onSign={setSigning}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <h2 className="font-heading text-base tracking-tight">Signed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kept here for a few months after you sign
        </p>
        {signed.length === 0 ? (
          <Card className="glass-panel mt-3 p-5 text-sm text-muted-foreground">
            No signed files in the last few months.
          </Card>
        ) : (
          <Card className="glass-panel mt-3 overflow-hidden py-0">
            <ul>
              {signed.map((item) => (
                <DocumentRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  onSign={setSigning}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {signing?.signatureId ? (
        <CompanyDocSignDialog
          signatureId={signing.signatureId}
          title={signing.title}
          lockedName={lockedName}
          open
          onClose={() => setSigning(null)}
        />
      ) : null}
    </div>
  );
}
