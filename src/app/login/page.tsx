import { googleAuthEnabled } from "@/auth";
import { LoginClient } from "./login-client";

const ERROR_HELP: Record<string, string> = {
  AccessDenied: "No account for that email. Ask an admin to add you.",
  CredentialsSignin: "Invalid email or password.",
  Configuration: "Auth is misconfigured. Check AUTH_SECRET / Google OAuth and restart the server.",
  OAuthAccountNotLinked: "Use the same sign-in method you used before, or ask an admin for help.",
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
    <LoginClient
      message={message}
      errorCode={error ?? null}
      googleEnabled={googleAuthEnabled}
    />
  );
}
