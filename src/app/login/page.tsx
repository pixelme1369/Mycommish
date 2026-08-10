import { LoginClient } from "./login-client";

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

  return <LoginClient message={message} errorCode={error ?? null} />;
}
