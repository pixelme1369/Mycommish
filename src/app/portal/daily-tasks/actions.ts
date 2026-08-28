"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth-guards";
import {
  setDailyTaskChannel,
  type DailyTaskChannel,
  type FollowUpKind,
} from "@/lib/portal/daily-tasks";

export async function toggleDailyTaskChannelAction(formData: FormData) {
  const session = await requireSession();
  const agentId = session.user.agentId;
  if (!agentId) return;

  const crmId = String(formData.get("crmId") || "").trim();
  const followUp = String(formData.get("followUp") || "").trim() as FollowUpKind;
  const enrolledYmd = String(formData.get("enrolledYmd") || "").trim();
  const channel = String(formData.get("channel") || "").trim() as DailyTaskChannel;
  const done = String(formData.get("done") || "") === "true";

  if (!crmId || !enrolledYmd) return;
  if (followUp !== "day3" && followUp !== "day10") return;
  if (channel !== "email" && channel !== "sms" && channel !== "call") return;

  await setDailyTaskChannel({
    agentId,
    crmId,
    followUp,
    enrolledYmd,
    channel,
    done,
  });
  revalidatePath("/portal/daily-tasks");
}
