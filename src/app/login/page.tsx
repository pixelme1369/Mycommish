import { SignIn } from "./sign-in-button";

const ERROR_HELP: Record<string, string> = {
  AccessDenied: "No portal account for that email.",
  CredentialsSignin: "Invalid email or password.",
  Configuration: "Auth is misconfigured. Check AUTH_SECRET and restart the server.",
  Default: "Sign-in failed. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error } = await searchParams;
  const message = error
    ? ERROR_HELP[error] || `${ERROR_HELP.Default} (code: ${error})`
    : null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-24">
      <p className="text-sm font-medium tracking-wide text-zinc-500">ADP</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">mycommish</h1>
      <p className="mt-3 text-zinc-600">
        Sign in with the email and password your admin set up.
      </p>

      {message ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{message}</p>
          {error ? (
            <p className="mt-2 font-mono text-xs text-red-700">error={error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <SignIn />
      </div>
    </main>
  );
}
