import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { homePathForSession } from "@/lib/auth-guards";
import HomeClient from "./home-client";

export default async function Home() {
  const session = await auth();
  if (session?.user?.agentId) {
    redirect(homePathForSession(session));
  }
  return <HomeClient />;
}
