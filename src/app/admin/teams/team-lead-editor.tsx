"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { deleteTeamLeadAction, saveTeamLeadAction } from "../team-actions";
import type { TeamLeadBonusScopeName } from "@/lib/teams/team-lead-bonus";

type AgentOption = {
  id: string;
  displayName: string;
  aliases: string[];
};

type TeamLeadOption = {
  id: string;
  leadAgentId: string;
  leadDisplayName: string;
  leadAgentName: string;
  ratePerUnit: number;
  bonusScope: TeamLeadBonusScopeName;
  members: { id: string; memberAgentName: string }[];
};

export function TeamLeadEditor({
  agents,
  salesReps,
  existing,
  lockLeadAgent = false,
}: {
  agents: AgentOption[];
  salesReps: string[];
  existing: TeamLeadOption | null;
  /** When opened from a specific user, the lead is fixed. */
  lockLeadAgent?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [leadAgentId, setLeadAgentId] = useState(
    existing?.leadAgentId ?? agents[0]?.id ?? "",
  );
  const [leadAgentName, setLeadAgentName] = useState(
    existing?.leadAgentName ?? agents[0]?.aliases[0] ?? "",
  );
  const [ratePerUnit, setRatePerUnit] = useState(
    String(existing?.ratePerUnit ?? 5),
  );
  const [bonusScope, setBonusScope] = useState<TeamLeadBonusScopeName>(
    existing?.bonusScope ?? "roster",
  );
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(existing?.members.map((m) => m.memberAgentName) ?? []),
  );
  const [memberFilter, setMemberFilter] = useState("");

  const selectedAgent = agents.find((a) => a.id === leadAgentId) ?? null;
  const aliases = selectedAgent?.aliases ?? [];

  const filteredReps = useMemo(() => {
    const q = memberFilter.trim().toLowerCase();
    const leadLower = leadAgentName.toLowerCase();
    return salesReps.filter((n) => {
      if (leadLower && n.toLowerCase() === leadLower) return false;
      if (!q) return true;
      return n.toLowerCase().includes(q);
    });
  }, [salesReps, memberFilter, leadAgentName]);

  function onLeadChange(id: string) {
    setLeadAgentId(id);
    const agent = agents.find((a) => a.id === id);
    const first = agent?.aliases[0] ?? "";
    setLeadAgentName(first);
  }

  function toggleMember(name: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function save() {
    setError(null);
    setMessage(null);
    start(async () => {
      const fd = new FormData();
      fd.set("leadAgentId", leadAgentId);
      fd.set("leadAgentName", leadAgentName);
      fd.set("ratePerUnit", ratePerUnit);
      fd.set("bonusScope", bonusScope);
      if (bonusScope === "roster") {
        for (const n of selectedMembers) fd.append("memberNames", n);
      }
      const res = await saveTeamLeadAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Saved — open periods updated.");
      router.refresh();
      router.push("/admin/agents");
    });
  }

  function remove() {
    if (!existing) return;
    if (!window.confirm(`Remove team for ${existing.leadDisplayName}?`)) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("teamLeadId", existing.id);
      const res = await deleteTeamLeadAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/agents");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="team-lead">Team lead (portal user)</Label>
          <select
            id="team-lead"
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={leadAgentId}
            onChange={(e) => onLeadChange(e.target.value)}
            disabled={Boolean(existing) || lockLeadAgent}
          >
            <option value="">Select…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
                {a.aliases.length ? ` (${a.aliases.join(", ")})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-crm">CRM pay name</Label>
          <select
            id="lead-crm"
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={leadAgentName}
            onChange={(e) => setLeadAgentName(e.target.value)}
            disabled={!leadAgentId}
          >
            <option value="">Select alias…</option>
            {aliases.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="rate">$ per cleared unit</Label>
        <Input
          id="rate"
          type="number"
          min="0"
          step="0.01"
          value={ratePerUnit}
          onChange={(e) => setRatePerUnit(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <Label>What units count?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBonusScope("all_period_units")}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
              bonusScope === "all_period_units"
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="font-medium">All period units</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Same total as “Units cleared” on the period page (e.g. 778). No member list.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setBonusScope("roster")}
            className={cn(
              "rounded-lg border px-3 py-3 text-left text-sm transition-colors",
              bonusScope === "roster"
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40",
            )}
          >
            <span className="font-medium">Selected team members</span>
            <p className="mt-1 text-xs text-muted-foreground">
              Only cleared units from the CRM reps you check below.
            </p>
          </button>
        </div>
      </div>

      {bonusScope === "roster" ? (
        <div className="space-y-2">
          <Label>Team members (CRM Sales Rep)</Label>
          <Input
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            placeholder="Filter names…"
            className="h-9 max-w-sm"
          />
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border p-2">
            {filteredReps.length === 0 ? (
              <p className="px-1 py-2 text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ul className="space-y-1">
                {filteredReps.map((name) => {
                  const checked = selectedMembers.has(name);
                  return (
                    <li key={name}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(name)}
                          className="rounded border-border"
                        />
                        <span>{name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedMembers.size} selected · bonus = their cleared units × rate on the
            lead’s period
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Bonus = period total units cleared × rate (includes every agent on that month).
        </p>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending || !leadAgentId} onClick={save}>
          {pending ? "Saving…" : existing ? "Update team" : "Save team"}
        </Button>
        {existing ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={remove}
          >
            Remove team
          </Button>
        ) : null}
      </div>
    </div>
  );
}
