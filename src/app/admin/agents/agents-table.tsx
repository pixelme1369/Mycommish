"use client";

import {
  useMemo,
  useState,
  useTransition,
  Fragment,
  type ReactNode,
} from "react";
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
import { updateAgentPhoneAction } from "@/app/portal/phone-actions";
import { formatPhoneForDisplay } from "@/lib/agents/phone";

export type AgentRoleView = "super_admin" | "admin" | "manager" | "agent" | "opener";
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
  phone: string | null;
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
    case "opener":
      return "Opener";
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
            <option value="opener">Opener</option>
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

function DetailSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg ring-1 ring-border/60">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border/50 bg-muted/40 px-3 py-1.5">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="bg-background px-3 py-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
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
    <div className="space-y-2.5 border-t border-border/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {suspended ? (
            <>
              Suspended
              {agent.suspendedAt ? ` ${formatLastLogin(agent.suspendedAt)}` : ""}
              {agent.suspendedByName ? ` by ${agent.suspendedByName}` : ""}. Login blocked.
            </>
          ) : (
            <>Google OAuth uses this email · password optional</>
          )}
        </p>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <a
            href={`/admin/teams?agentId=${agent.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7")}
          >
            Team lead
          </a>
          {!isSelf ? (
            suspended ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
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
                className="h-7"
                disabled={busy}
                onClick={onSuspend}
              >
                Suspend login
              </Button>
            )
          ) : null}
        </div>
      </div>

      <DetailSection title="Profile">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
          <form
            key={`name-${agent.id}-${agent.displayName}`}
            action={updateDisplayNameAction}
            className="flex min-w-[10rem] flex-[1.2] items-end gap-1.5"
          >
            <input type="hidden" name="agentId" value={agent.id} />
            <Field label="Display name" className="flex-1">
              <Input
                name="displayName"
                required
                defaultValue={agent.displayName}
                placeholder="Display name"
                className="h-8"
              />
            </Field>
            <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
              Save
            </Button>
          </form>

          <form
            key={`role-${agent.id}-${agent.role}`}
            action={updateRoleAction}
            className="flex min-w-[8rem] flex-1 items-end gap-1.5"
          >
            <input type="hidden" name="agentId" value={agent.id} />
            <Field label="Role" className="flex-1">
              <select
                name="role"
                defaultValue={agent.role}
                className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="agent">Agent</option>
                <option value="opener">Opener</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super admin</option>
              </select>
            </Field>
            <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
              Save
            </Button>
          </form>

          <form
            key={`phone-${agent.id}-${agent.phone || ""}`}
            action={updateAgentPhoneAction}
            className="flex min-w-[9rem] flex-1 items-end gap-1.5"
          >
            <input type="hidden" name="agentId" value={agent.id} />
            <Field label="Mobile" htmlFor={`phone-${agent.id}`} className="flex-1">
              <Input
                id={`phone-${agent.id}`}
                name="phone"
                type="tel"
                defaultValue={formatPhoneForDisplay(agent.phone)}
                placeholder="(555) 123-4567"
                className="h-8"
              />
            </Field>
            <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
              Save
            </Button>
          </form>

          <form
            action={setPasswordAction}
            className="flex min-w-[11rem] flex-[1.1] items-end gap-1.5"
          >
            <input type="hidden" name="agentId" value={agent.id} />
            <Field label="Password" className="flex-1">
              <Input
                name="password"
                type="password"
                required
                minLength={6}
                placeholder={agent.hasPassword ? "New (min 6)" : "Set (min 6)"}
                className="h-8"
              />
            </Field>
            <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
              {agent.hasPassword ? "Update" : "Set"}
            </Button>
            {agent.hasPassword ? (
              <button
                formAction={clearPasswordAction}
                formNoValidate
                type="submit"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2")}
              >
                Clear
              </button>
            ) : null}
          </form>
        </div>
      </DetailSection>

      <DetailSection
        title="Employment"
        hint={
          isContractor
            ? agent.companyName
              ? `1099 · ${agent.companyName}`
              : "1099 contractor"
            : "Employee"
        }
      >
        <form
          key={`employment-${agent.id}-${agent.employmentType}-${agent.companyName || ""}`}
          action={updateEmploymentAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              name="isContractor"
              type="checkbox"
              defaultChecked={isContractor}
              className="rounded border-input"
            />
            1099
          </label>
          <Field label="Company" className="min-w-[12rem] flex-1">
            <Input
              name="companyName"
              defaultValue={agent.companyName || ""}
              placeholder="Optional"
              className="h-8"
            />
          </Field>
          <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
            Save
          </Button>
        </form>
      </DetailSection>

      <DetailSection title="Gusto payroll" hint="Legal name + employee ID for export">
        <form
          key={`gusto-${agent.id}-${agent.gustoEmployeeId || ""}-${agent.gustoFirstName || ""}-${agent.gustoLastName || ""}`}
          action={updateGustoProfileAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <Field
            label="First name"
            htmlFor={`gusto-first-${agent.id}`}
            className="min-w-[8rem] flex-1"
          >
            <Input
              id={`gusto-first-${agent.id}`}
              name="gustoFirstName"
              defaultValue={agent.gustoFirstName || ""}
              placeholder="First"
              className="h-8"
            />
          </Field>
          <Field
            label="Last name"
            htmlFor={`gusto-last-${agent.id}`}
            className="min-w-[8rem] flex-1"
          >
            <Input
              id={`gusto-last-${agent.id}`}
              name="gustoLastName"
              defaultValue={agent.gustoLastName || ""}
              placeholder="Last"
              className="h-8"
            />
          </Field>
          <Field
            label="Employee ID"
            htmlFor={`gusto-id-${agent.id}`}
            className="min-w-[7rem] flex-1"
          >
            <Input
              id={`gusto-id-${agent.id}`}
              name="gustoEmployeeId"
              defaultValue={agent.gustoEmployeeId || ""}
              placeholder="e.g. 85260d"
              className="h-8 font-mono text-xs"
            />
          </Field>
          <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2.5">
            Save
          </Button>
        </form>
      </DetailSection>

      <DetailSection title="CRM aliases">
        <div className="flex flex-wrap items-start gap-3">
          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {agent.aliases.length === 0 ? (
              <li className="text-[11px] text-muted-foreground">None yet</li>
            ) : (
              agent.aliases.map((al) => (
                <li
                  key={al.id}
                  className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1 ring-1 ring-border/50"
                >
                  <span className="font-mono text-xs">{al.agentName}</span>
                  <DeleteAliasButton aliasId={al.id} agentName={al.agentName} />
                </li>
              ))
            )}
          </ul>
          <div className="min-w-[14rem] flex-[1.2]">
            <AliasAutocomplete
              agentId={agent.id}
              suggestions={salesReps}
              excludeNames={agent.aliases.map((al) => al.agentName)}
            />
          </div>
        </div>
      </DetailSection>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
