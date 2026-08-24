"use server";

import { revalidatePath } from "next/cache";
import {
  canActAsManager,
  isAdminUser,
  requireSession,
} from "@/lib/auth-guards";
import {
  cancelAdvance,
  createAdvance,
  type AdvanceActionResult,
} from "@/lib/advances";

export type AdvanceFormState = AdvanceActionResult | null;

/** Managers, admins, and super admins may create / cancel advances. */
async function requireAdvanceStaff() {
  const session = await requireSession();
  if (!isAdminUser(session) && !canActAsManager(session)) {
    return {
      ok: false as const,
      error: "Only managers and above can manage advances.",
    };
  }
  return { ok: true as const, session };
}

export async function createAdvanceAction(
  _prev: AdvanceFormState,
  formData: FormData,
): Promise<AdvanceFormState> {
  const gate = await requireAdvanceStaff();
  if (!gate.ok) return gate;
  const createdById = gate.session.user.agentId;
  if (!createdById) return { ok: false, error: "Not signed in." };

  const agentName = String(formData.get("agentName") || "");
  const agentIdRaw = String(formData.get("agentId") || "").trim();
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") || "") || null;
  const payWithPeriodLabel = String(formData.get("payWithPeriodLabel") || "");
  const deductFromPeriodLabel = String(formData.get("deductFromPeriodLabel") || "");

  const res = await createAdvance({
    createdById,
    agentName,
    agentId: agentIdRaw || null,
    amount,
    note,
    payWithPeriodLabel,
    deductFromPeriodLabel,
  });

  if (res.ok) {
    revalidatePath("/manager/advances");
    revalidatePath("/admin");
    revalidatePath("/manager");
    revalidatePath("/admin/periods");
    revalidatePath("/manager/periods");
  }
  return res;
}

export async function cancelAdvanceAction(
  advanceId: string,
): Promise<AdvanceActionResult> {
  const gate = await requireAdvanceStaff();
  if (!gate.ok) return gate;
  const res = await cancelAdvance({ advanceId });
  if (res.ok) {
    revalidatePath("/manager/advances");
    revalidatePath("/admin");
    revalidatePath("/manager");
    revalidatePath("/admin/periods");
    revalidatePath("/manager/periods");
  }
  return res;
}
