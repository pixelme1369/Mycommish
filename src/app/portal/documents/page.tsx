import { redirect } from "next/navigation";
import { isSuperAdminUser, requireSession, sessionRole } from "@/lib/auth-guards";
import { adminNavLabel, isOpenerRole } from "@/lib/roles";
import { AppShell } from "@/components/app-shell";
import { PortalTopBar } from "@/components/portal-top-bar";
import { listPortalDocuments } from "@/lib/portal/signed-documents";
import { SignedDocumentsList } from "./documents-list";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const session = await requireSession();
  if (isSuperAdminUser(session)) redirect("/admin");

  const agentId = session.user.agentId;
  const aliasNames = session.user.aliasNames || [];
  const role = sessionRole(session);

  const staffHref =
    session.user.isAdmin || role === "admin"
      ? "/admin"
      : role === "manager"
        ? "/manager"
        : undefined;
  const staffLabel =
    session.user.isAdmin || role === "admin"
      ? `${adminNavLabel(session.user.role)} →`
      : role === "manager"
        ? "Manager →"
        : undefined;

  const topBar = (
    <PortalTopBar
      commissionsHref={
        role === "manager" || session.user.isAdmin || role === "admin"
          ? "/portal?personal=1"
          : "/portal"
      }
      filesHref="/portal/files"
      staffHref={staffHref}
      staffLabel={staffLabel}
      opener={isOpenerRole(session.user.role)}
      openerManager={false}
    />
  );

  if (!agentId) {
    return (
      <AppShell wide>
        {topBar}
        <header className="mt-8">
          <h1 className="font-heading text-2xl tracking-tight">Signed documents</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in required.</p>
        </header>
      </AppShell>
    );
  }

  const { pending, signed } = await listPortalDocuments({
    agentId,
    aliasNames,
  });

  return (
    <AppShell wide>
      {topBar}
      <header className="mt-8">
        <h1 className="font-heading text-2xl tracking-tight text-foreground sm:text-[1.65rem]">
          Signed documents
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.user.displayName} · pending signatures, signed copies, and records on file
        </p>
      </header>
      <SignedDocumentsList
        pending={pending}
        signed={signed}
        lockedName={session.user.displayName || ""}
      />
    </AppShell>
  );
}
