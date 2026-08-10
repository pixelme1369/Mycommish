import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user?.agentId) {
    redirect(session.user.isAdmin ? "/admin" : "/portal");
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-8 px-6 py-24">
      <div>
        <p className="text-sm font-medium tracking-wide text-zinc-500">ADP</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">mycommish</h1>
        <p className="mt-3 text-zinc-600">Agent commission portal.</p>
      </div>
      <Link
        href="/login"
        className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Sign in
      </Link>
    </main>
  );
}
