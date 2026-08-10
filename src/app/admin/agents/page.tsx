import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import { SignOutButton } from "@/components/sign-out-button";
import {
  addAliasAction,
  createAgentAction,
  listAgents,
  updateEmploymentAction,
} from "./actions";
import { DeleteAgentButton, DeleteAliasButton } from "./delete-buttons";
import { EmploymentType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ManageAgentsPage() {
  await requireAdmin();
  const agents = await listAgents();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/admin" className="hover:underline">
              ← Admin
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Manage agents</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Email allowlist for Google sign-in. Aliases must match CRM “Sales Rep” spellings
            exactly. Contractors are tagged for a different commission sheet on export.
          </p>
        </div>
        <SignOutButton />
      </div>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium">Add login</h2>
        <form action={createAgentAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="displayName"
            type="text"
            required
            placeholder="Display name"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input name="isAdmin" type="checkbox" className="rounded border-zinc-300" />
            Admin
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input name="isContractor" type="checkbox" className="rounded border-zinc-300" />
            Contractor
          </label>
          <input
            name="companyName"
            type="text"
            placeholder="Company (contractors)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:col-span-2 sm:justify-self-end"
          >
            Create
          </button>
        </form>
      </section>

      <ul className="mt-8 space-y-4">
        {agents.map((a) => {
          const isContractor = a.employmentType === EmploymentType.contractor;
          return (
            <li key={a.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {a.displayName}
                    {a.isAdmin ? (
                      <span className="ml-2 text-xs font-normal text-amber-700">admin</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-zinc-500">{a.email}</p>
                  {isContractor ? (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Contractor
                      {a.companyName ? ` · ${a.companyName}` : ""}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-zinc-400">Employee</p>
                  )}
                </div>
                <DeleteAgentButton agentId={a.id} displayName={a.displayName} />
              </div>

              <form
                action={updateEmploymentAction}
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3"
              >
                <input type="hidden" name="agentId" value={a.id} />
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    name="isContractor"
                    type="checkbox"
                    defaultChecked={isContractor}
                    className="rounded border-zinc-300"
                  />
                  Contractor
                </label>
                <input
                  name="companyName"
                  type="text"
                  defaultValue={a.companyName || ""}
                  placeholder="Company name"
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs hover:bg-zinc-50"
                >
                  Save
                </button>
              </form>

              <ul className="mt-3 space-y-1 text-sm">
                {a.aliases.length === 0 ? (
                  <li className="text-zinc-400">No CRM aliases yet</li>
                ) : (
                  a.aliases.map((al) => (
                    <li key={al.id} className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{al.agentName}</span>
                      <DeleteAliasButton aliasId={al.id} agentName={al.agentName} />
                    </li>
                  ))
                )}
              </ul>

              <form action={addAliasAction} className="mt-3 flex gap-2">
                <input type="hidden" name="agentId" value={a.id} />
                <input
                  name="agentName"
                  type="text"
                  required
                  placeholder='Exact Sales Rep, e.g. "AJ Valipour"'
                  className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  Add alias
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
