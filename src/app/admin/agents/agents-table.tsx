"use client";

import { useMemo, useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreActionsMenu } from "@/components/more-actions-menu";
import { LoginAsUserButton, useLoginAsUser } from "@/components/impersonation";
import { cn } from "@/lib/utils";
import { AliasAutocomplete } from "./alias-autocomplete";
import { DeleteAgentButton, DeleteAliasButton } from "./delete-buttons";
import {
  activateAgentAction,
  clearPasswordAction,
  setPasswordAction,
  suspendAgentAction,
  updateDisplayNameAction,
  updateEmploymentAction,
  updateGustoProfileAction,
  updateRoleAction,
} from "./actions";

export type AgentRoleView = "super_admin" | "admin" | "manager" | "agent";
export type EmploymentTypeView = "employee" | "contractor";

export type AgentRowView = {
  id: string;
  email: string;
  displayName: string;
  role: AgentRoleView;
  employmentType: EmploymentTypeView;
  companyName: string | null;
  gustoFirstName: string | null;
  gustoLastName: string | null;
  gustoEmployeeId: string | null;
  hasPassword: boolean;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspendedByName: string | null;
  aliases: Array<{ id: string; agentName: string }>;
};

function roleLabel(role: AgentRoleView) {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    default:
      return "Agent";
  }
}

function formatLastLogin(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AgentsUsersTable({
  agents,
  salesReps,
  currentAdminId,
}: {
  agents: AgentRowView[];
  salesReps: string[];
  currentAdminId: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AgentRoleView>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">(
    "all",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const { loginAs, pending: loginAsPending } = useLoginAsUser();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (roleFilter !== "all" && a.role !== roleFilter) return false;
      const suspended = Boolean(a.suspendedAt);
      if (statusFilter === "active" && suspended) return false;
      if (statusFilter === "suspended" && !suspended) return false;
      if (!needle) return true;
      return (
        a.displayName.toLowerCase().includes(needle) ||
        a.email.toLowerCase().includes(needle) ||
        a.aliases.some((al) => al.agentName.toLowerCase().includes(needle))
      );
    });
  }, [agents, q, roleFilter, statusFilter]);

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  function runSuspend(agentId: string, activate: boolean) {
    start(async () => {
      const fd = new FormData();
      fd.set("agentId", agentId);
      if (activate) await activateAgentAction(fd);
      else await suspendAgentAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor="users-search" className="text-[11px] text-muted-foreground">
            Search
          </Label>
          <Input
            id="users-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, or alias…"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="role-filter" className="text-[11px] text-muted-foreground">
            Role
          </Label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            className="flex h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="all">Any role</option>
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="status-filter" className="text-[11px] text-muted-foreground">
            Status
          </Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="all">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          {filtered.length} of {agents.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-border/70">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[5.5rem]">Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Employment</TableHead>
              <TableHead>Aliases</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => {
                const suspended = Boolean(a.suspendedAt);
                const expanded = expandedId === a.id;
                const isSelf = currentAdminId === a.id;
                return (
                  <Fragment key={a.id}>
                    <TableRow
                      className={cn(suspended && "bg-muted/20", expanded && "bg-muted/10")}
                    >
                      <TableCell>
                        <Badge
                          variant={suspended ? "secondary" : "outline"}
                          className={cn(
                            "font-normal",
                            !suspended && "border-money/50 text-money",
                          )}
                        >
                          {suspended ? "Suspended" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => toggleExpand(a.id)}
                        >
                          {a.displayName}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {a.email}
                      </TableCell>
                      <TableCell className="text-xs">{roleLabel(a.role)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.employmentType === "contractor"
                          ? a.companyName
                            ? `1099 · ${a.companyName}`
                            : "1099"
                          : "Employee"}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-xs font-mono text-muted-foreground">
                        {a.aliases.length
                          ? a.aliases.map((al) => al.agentName).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatLastLogin(a.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.hasPassword ? "Google · Password" : "Google"}
                      </TableCell>
                      <TableCell>
                        <MoreActionsMenu estimatedHeight={230} menuWidth={180}>
                          {(close) => (
                            <div className="py-1 text-sm">
                              <button
                                type="button"
                                className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                                onClick={() => {
                                  toggleExpand(a.id);
                                  close();
                                }}
                              >
                                {expanded ? "Hide details" : "Edit details"}
                              </button>
                              <a
                                role="menuitem"
                                href={`/admin/teams?agentId=${a.id}`}
                                className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                                onClick={close}
                              >
                                Team lead
                              </a>
                              {!isSelf && !suspended ? (
                                <button
                                  type="button"
                                  disabled={busy || loginAsPending}
                                  className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                                  onClick={() => {
                                    close();
                                    loginAs(a.id);
                                  }}
                                >
                                  Login as user
                                </button>
                              ) : null}
                              {!isSelf ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="block w-full px-3 py-1.5 text-left hover:bg-muted disabled:opacity-50"
                                  onClick={() => {
                                    runSuspend(a.id, suspended);
                                    close();
                                  }}
                                >
                                  {suspended ? "Activate" : "Suspend login"}
                                </button>
                              ) : null}
                            </div>
                          )}
                        </MoreActionsMenu>
                      </TableCell>
                    </TableRow>
                    {expanded ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="bg-muted/20 p-0">
                          <AgentDetailPanel
                            agent={a}
                            salesReps={salesReps}
                            isSelf={isSelf}
                            onSuspend={() => runSuspend(a.id, false)}
                            onActivate={() => runSuspend(a.id, true)}
                            busy={busy}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AgentDetailPanel({
  agent,
  salesReps,
  isSelf,
  onSuspend,
  onActivate,
  busy,
}: {
  agent: AgentRowView;
  salesReps: string[];
  isSelf: boolean;
  onSuspend: () => void;
  onActivate: () => void;
  busy: boolean;
}) {
  const suspended = Boolean(agent.suspendedAt);
  const isContractor = agent.employmentType === "contractor";

  return (
    <div className="space-y-4 border-t border-border/60 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {suspended ? (
            <p>
              Suspended
              {agent.suspendedAt
                ? ` ${formatLastLogin(agent.suspendedAt)}`
                : ""}
              {agent.suspendedByName ? ` by ${agent.suspendedByName}` : ""}
              . Portal login is blocked.
            </p>
          ) : (
            <p>
              Google sign-in works with this email when Google OAuth is enabled. Password is
              optional.
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={`/admin/teams?agentId=${agent.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
          >
            Team lead
          </a>
          {!isSelf ? (
            suspended ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={busy}
                onClick={onActivate}
              >
                Activate
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={busy}
                onClick={onSuspend}
              >
                Suspend login
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <form
          key={`name-${agent.id}-${agent.displayName}`}
          action={updateDisplayNameAction}
          className="flex min-w-0 flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-border/60"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Display name
          </p>
          <Input
            name="displayName"
            required
            defaultValue={agent.displayName}
            placeholder="Display name"
            className="h-9 min-w-0"
          />
          <Button type="submit" size="sm" variant="outline" className="mt-auto h-8 w-fit">
            Save name
          </Button>
        </form>

        <form
          key={`role-${agent.id}-${agent.role}`}
          action={updateRoleAction}
          className="flex min-w-0 flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-border/60"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Role
          </p>
          <select
            name="role"
            defaultValue={agent.role}
            className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super admin</option>
          </select>
          <Button type="submit" size="sm" variant="outline" className="mt-auto h-8 w-fit">
            Save role
          </Button>
        </form>

        <form
          action={setPasswordAction}
          className="flex min-w-0 flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-border/60"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Password (optional)
          </p>
          <p className="text-[11px] text-muted-foreground">
            Leave unset to use Google only. Setting a password does not disable Google.
          </p>
          <Input
            name="password"
            type="password"
            required
            minLength={6}
            placeholder={agent.hasPassword ? "New password (min 6)" : "Set password (min 6)"}
            className="h-9 min-w-0"
          />
          <div className="mt-auto flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="outline" className="h-8">
              {agent.hasPassword ? "Update" : "Set"}
            </Button>
            {agent.hasPassword ? (
              <button
                formAction={clearPasswordAction}
                formNoValidate
                type="submit"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8")}
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <details className="rounded-lg bg-background px-3 py-2 ring-1 ring-border/60">
        <summary className="cursor-pointer list-none text-[11px] font-medium tracking-wide text-muted-foreground uppercase marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>Employment</span>
            <span className="font-normal normal-case tracking-normal text-foreground/70">
              {isContractor
                ? agent.companyName
                  ? `1099 · ${agent.companyName}`
                  : "1099 contractor"
                : "Employee"}
            </span>
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · edit
            </span>
          </span>
        </summary>
        <form
          key={`employment-${agent.id}-${agent.employmentType}-${agent.companyName || ""}`}
          action={updateEmploymentAction}
          className="mt-2 flex flex-wrap items-end gap-2 border-t border-border/50 pt-2"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              name="isContractor"
              type="checkbox"
              defaultChecked={isContractor}
              className="rounded border-input"
            />
            1099
          </label>
          <Input
            name="companyName"
            defaultValue={agent.companyName || ""}
            placeholder="Company (optional)"
            className="h-9 min-w-[12rem] flex-1"
          />
          <Button type="submit" size="sm" variant="outline" className="h-8">
            Save
          </Button>
        </form>
      </details>

      <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Gusto payroll
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Legal name + employee ID for the Gusto export. Prefills from roster when we can match
          a CRM alias — edit anytime.
        </p>
        <form
          key={`gusto-${agent.id}-${agent.gustoEmployeeId || ""}-${agent.gustoFirstName || ""}-${agent.gustoLastName || ""}`}
          action={updateGustoProfileAction}
          className="mt-3 grid gap-2 sm:grid-cols-3"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <div className="space-y-1">
            <Label htmlFor={`gusto-first-${agent.id}`} className="text-xs text-muted-foreground">
              First name
            </Label>
            <Input
              id={`gusto-first-${agent.id}`}
              name="gustoFirstName"
              defaultValue={agent.gustoFirstName || ""}
              placeholder="Gusto first name"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`gusto-last-${agent.id}`} className="text-xs text-muted-foreground">
              Last name
            </Label>
            <Input
              id={`gusto-last-${agent.id}`}
              name="gustoLastName"
              defaultValue={agent.gustoLastName || ""}
              placeholder="Gusto last name"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`gusto-id-${agent.id}`} className="text-xs text-muted-foreground">
              Employee ID
            </Label>
            <Input
              id={`gusto-id-${agent.id}`}
              name="gustoEmployeeId"
              defaultValue={agent.gustoEmployeeId || ""}
              placeholder="e.g. 85260d"
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" variant="outline" className="h-8">
              Save Gusto
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg bg-background p-3 ring-1 ring-border/60">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          CRM aliases
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {agent.aliases.length === 0 ? (
            <li className="text-xs text-muted-foreground">No aliases yet</li>
          ) : (
            agent.aliases.map((al) => (
              <li key={al.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{al.agentName}</span>
                <DeleteAliasButton aliasId={al.id} agentName={al.agentName} />
              </li>
            ))
          )}
        </ul>
        <AliasAutocomplete
          agentId={agent.id}
          suggestions={salesReps}
          excludeNames={agent.aliases.map((al) => al.agentName)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
        {!isSelf && !suspended ? (
          <LoginAsUserButton agentId={agent.id} displayName={agent.displayName} />
        ) : (
          <span />
        )}
        <DeleteAgentButton agentId={agent.id} displayName={agent.displayName} />
      </div>
    </div>
  );
}
