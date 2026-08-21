import { redirect } from "next/navigation";

/** Old path — super-admin-only page lives under `/superadmin`. */
export default function AdminManualBonusesRedirect() {
  redirect("/superadmin/manual-bonuses");
}
