"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { fileKindLabel } from "@/lib/portal/file-labels";
import type { ClientEventKind } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  claimFileFromLookupAction,
  type ClaimActionState,
} from "./actions";
import type { LookupChatResult, LookupHitView } from "./lookup-action";

type ClaimLookupFn = (
  externalId: string,
  clientName: string,
  note?: string,
) => Promise<ClaimActionState>;

export type AgentFileRowView = {
  crmId: string;
  externalId?: string | null;
  clientName: string | null;
  kind: ClientEventKind;
  enrolledDate: string | null;
  firstPaymentClearedDate: string | null;
  droppedDate: string | null;
  periodId: string;
  periodLabel: string;
  agentPeriodId: string | null;
  agentName: string;
};

export function AgentFilesTable({
  files,
  showAgent = false,
  allowClaim = false,
}: {
  files: AgentFileRowView[];
  showAgent?: boolean;
  allowClaim?: boolean;
}) {
  const [q, setQ] = useState("");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return files;
    return files.filter(
      (f) =>
        f.crmId.toLowerCase().includes(needle) ||
        (f.externalId || "").toLowerCase().includes(needle) ||
        (f.clientName || "").toLowerCase().includes(needle) ||
        (showAgent && f.agentName.toLowerCase().includes(needle)),
    );
  }, [files, q, showAgent]);

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          showAgent
            ? "Filter by External ID, name, or sales rep…"
            : "Filter by External ID or name…"
        }
        className="max-w-sm"
      />
      {claimMsg ? <p className="text-sm text-muted-foreground">{claimMsg}</p> : null}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files match.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>External ID</TableHead>
                <TableHead>Name</TableHead>
                {showAgent ? <TableHead>Sales rep</TableHead> : null}
                <TableHead>Status</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>1st payment cleared</TableHead>
                <TableHead>Dropped</TableHead>
                <TableHead>Period</TableHead>
                {allowClaim ? <TableHead className="text-right"> </TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={`${f.crmId}-${f.periodId}`}>
                  <TableCell className="font-mono text-xs">
                    {f.externalId || f.crmId}
                  </TableCell>
                  <TableCell className="font-medium">{f.clientName || "—"}</TableCell>
                  {showAgent ? (
                    <TableCell className="text-muted-foreground">{f.agentName || "—"}</TableCell>
                  ) : null}
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {fileKindLabel(f.kind)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.enrolledDate || "—"}</TableCell>
                  <TableCell>{f.firstPaymentClearedDate || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{f.droppedDate || "—"}</TableCell>
                  <TableCell>
                    {f.agentPeriodId ? (
                      <Link
                        href={`/portal/period/${f.periodId}/agent/${f.agentPeriodId}`}
                        className="hover:underline"
                      >
                        {f.periodLabel}
                      </Link>
                    ) : (
                      f.periodLabel
                    )}
                  </TableCell>
                  {allowClaim ? (
                    <TableCell className="text-right">
                      <ClaimButton
                        externalId={f.externalId || f.crmId}
                        clientName={f.clientName || "Unknown"}
                        onDone={(res) => {
                          setClaimMsg(
                            res?.ok
                              ? `Claimed ${f.externalId || f.crmId} — in My claims for admin review.`
                              : res?.error || "Could not claim",
                          );
                        }}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

type ChatMessage = {
  role: "user" | "bot";
  text: string;
  hits?: LookupHitView[];
  claimDraft?: LookupChatResult["claimDraft"];
};

function ClaimButton({
  externalId,
  clientName,
  claimAction = claimFileFromLookupAction,
  onDone,
}: {
  externalId: string;
  clientName: string;
  claimAction?: ClaimLookupFn;
  onDone: (result: ClaimActionState) => void;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={pending || done || !externalId || !clientName}
      onClick={() => {
        start(async () => {
          const res = await claimAction(externalId, clientName);
          if (res?.ok) setDone(true);
          onDone(res);
        });
      }}
    >
      {done ? "Claimed" : pending ? "…" : "Claim"}
    </Button>
  );
}

export function FileLookupChat({
  lookupAction,
  claimAction = claimFileFromLookupAction,
  intro = "Ask about a file by External ID (ADP CRM) or client name. I’ll show status and when the 1st payment cleared (from CRM). Use Claim to send it to My claims for admin review.",
  clearedLabel = "1st payment cleared",
}: {
  lookupAction: (query: string) => Promise<LookupChatResult>;
  claimAction?: ClaimLookupFn;
  intro?: string;
  clearedLabel?: string;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: intro,
    },
  ]);
  const [pending, start] = useTransition();

  function pushBotNote(text: string) {
    setMessages((m) => [...m, { role: "bot", text }]);
  }

  function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || pending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    start(async () => {
      const res = await lookupAction(q);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: res.reply,
          hits: res.hits,
          claimDraft: res.claimDraft,
        },
      ]);
    });
  }

  return (
    <div className="space-y-3">
      <div className="max-h-80 space-y-3 overflow-y-auto rounded-xl bg-muted/30 p-3 ring-1 ring-foreground/10">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                m.role === "user"
                  ? "inline-block rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "inline-block max-w-full rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.hits && m.hits.length > 0 ? (
                <ul className="mt-2 space-y-2 border-t border-border pt-2 text-left">
                  {m.hits.map((h) => {
                    const ext = h.externalId || h.crmId;
                    return (
                      <li
                        key={h.crmId}
                        className="flex flex-wrap items-start justify-between gap-2 text-xs leading-relaxed"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono font-medium">{ext}</span>
                          {" · "}
                          <span className="font-medium">{h.clientName || "—"}</span>
                          <br />
                          Status: {h.kindLabel}
                          {h.periodLabel ? ` · Period ${h.periodLabel}` : ""}
                          <br />
                          Enrolled: {h.enrolledDate || "—"}
                          <br />
                          {clearedLabel}:{" "}
                          <span className="font-medium">
                            {h.firstPaymentClearedDate || "—"}
                          </span>
                          {h.droppedDate ? (
                            <>
                              <br />
                              Dropped: {h.droppedDate}
                            </>
                          ) : null}
                        </div>
                        {h.claimable ? (
                          <ClaimButton
                            externalId={ext}
                            clientName={h.clientName || "Unknown"}
                            claimAction={claimAction}
                            onDone={(res) => {
                              if (!res) return;
                              pushBotNote(
                                res.ok
                                  ? `Claimed ${ext} — it’s in My claims for review.`
                                  : res.error,
                              );
                            }}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {m.claimDraft ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-left text-xs">
                  <span>
                    <span className="font-mono font-medium">{m.claimDraft.externalId}</span>
                    {" · "}
                    {m.claimDraft.clientName}
                  </span>
                  <ClaimButton
                    externalId={m.claimDraft.externalId}
                    clientName={m.claimDraft.clientName}
                    claimAction={claimAction}
                    onDone={(res) => {
                      if (!res) return;
                      pushBotNote(
                        res.ok
                          ? `Claimed ${m.claimDraft!.externalId} — it’s in My claims for review.`
                          : res.error,
                      );
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={onAsk} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="External ID or client name…"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
