"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { Monogram } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { api, ApiError, errorMessage } from "@/lib/api/client";
import { useAfterLogin, useSite, useUser } from "@/lib/hooks";
import type { User } from "@/lib/types";
import { cn, SITE_URL } from "@/lib/utils";

/** Only same-site paths are honoured as a post-login destination. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export function AuthCard({ title, text, children, footer }: { title: string; text?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grain -mt-[68px] flex min-h-[86vh] items-center justify-center bg-gradient-to-b from-blush to-ivory px-5 pb-16 pt-[110px] md:-mt-20 md:pt-[130px]">
      <div className="w-full max-w-[440px] rounded-[26px] border hairline bg-ivory/90 p-7 shadow-lift backdrop-blur md:p-9">
        <Monogram className="mx-auto h-16 w-auto" title="" />
        <h1 className="mt-4 text-center text-4xl">{title}</h1>
        {text && <p className="mt-2 text-center text-mocha">{text}</p>}
        <div className="mt-7">{children}</div>
        {footer && <div className="mt-6 border-t hairline pt-5 text-center text-sm text-mocha">{footer}</div>}
      </div>
    </div>
  );
}

function useFinishLogin() {
  const router = useRouter();
  const search = useSearchParams();
  const afterLogin = useAfterLogin();
  return async (user: User) => {
    await afterLogin(user);
    toast.success(`Welcome${user.first_name ? `, ${user.first_name}` : ""}`);
    router.replace(safeNext(search.get("next")));
  };
}

function useRedirectIfSignedIn() {
  const { user } = useUser();
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (user) router.replace(safeNext(search.get("next")));
  }, [user, router, search]);
}

function GoogleButton() {
  const site = useSite();
  const search = useSearchParams();
  if (!site?.google_client_id) return null;
  const start = () => {
    sessionStorage.setItem("hh-auth-next", safeNext(search.get("next")));
    const params = new URLSearchParams({
      client_id: site.google_client_id, redirect_uri: `${SITE_URL}/account/google`, response_type: "code",
      scope: "openid email profile", prompt: "select_account",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-mocha">
        <span className="h-px flex-1 bg-sand" /> or <span className="h-px flex-1 bg-sand" />
      </div>
      <Button variant="outline" full type="button" onClick={start}>Continue with Google</Button>
    </>
  );
}

export function LoginForm() {
  useRedirectIfSignedIn();
  const finish = useFinishLogin();
  const search = useSearchParams();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = search.get("next");
  const suffix = next ? `?next=${encodeURIComponent(next)}` : "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (mode === "password") {
        finish(await api<User>("/auth/login/", { method: "POST", body: { email, password: form.get("password") } }));
      } else if (!otpSent) {
        const result = await api<{ detail: string }>("/auth/otp/request/", { method: "POST", body: { email } });
        setOtpSent(true);
        toast.success(result.detail);
      } else {
        finish(await api<User>("/auth/otp/verify/", { method: "POST", body: { email, code: String(form.get("code")).trim() } }));
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 && mode === "password" ? "That email and password do not match. Please try again." : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back" text="Sign in to see your orders, addresses and wishlist."
      footer={<>New here? <Link href={`/account/register${suffix}`} className="font-bold text-deep underline underline-offset-4">Create an account</Link></>}
    >
      <div className="mb-5 grid grid-cols-2 rounded-full bg-cream p-1 text-sm" role="tablist" aria-label="Sign-in method">
        {(["password", "otp"] as const).map((m) => (
          <button
            key={m} type="button" role="tab" aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
              setOtpSent(false);
            }}
            className={cn("rounded-full py-2.5 transition-colors", mode === m ? "bg-mocha font-bold text-ivory" : "text-deep")}
          >
            {m === "password" ? "Password" : "Email code"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-mocha">Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1.5" autoComplete="email" readOnly={otpSent} />
        </label>
        {mode === "password" ? (
          <label className="block text-sm text-mocha">
            <span className="flex justify-between">Password <Link href="/account/forgot-password" className="underline underline-offset-4">Forgot?</Link></span>
            <input name="password" type="password" required className="field mt-1.5" autoComplete="current-password" />
          </label>
        ) : otpSent ? (
          <label className="block text-sm text-mocha">6-digit code from your email
            <input name="code" required inputMode="numeric" pattern="\d{6}" maxLength={6} autoFocus className="field mt-1.5 text-center text-2xl tracking-[0.4em]" autoComplete="one-time-code" />
          </label>
        ) : (
          <p className="text-sm text-mocha">We will email you a one-time code. No password needed, and it works for new accounts too.</p>
        )}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" full size="lg" loading={busy}>
          {mode === "password" ? "Sign in" : otpSent ? "Verify and sign in" : "Email me a code"}
        </Button>
      </form>
      <GoogleButton />
    </AuthCard>
  );
}

export function RegisterForm() {
  useRedirectIfSignedIn();
  const finish = useFinishLogin();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const next = search.get("next");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setErrors({});
    try {
      finish(await api<User>("/auth/register/", {
        method: "POST",
        body: {
          email: form.get("email"), password: form.get("password"), first_name: form.get("first_name"),
          last_name: form.get("last_name") ?? "", accepts_marketing: form.get("accepts_marketing") === "on",
        },
      }));
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else setErrors({ form: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const err = (name: string) => errors[name] && <span className="mt-1 block text-xs text-danger" role="alert">{errors[name]}</span>;

  return (
    <AuthCard
      title="Join the family" text="Faster checkout, order tracking and a wishlist that follows you."
      footer={<>Already have an account? <Link href={`/account/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-bold text-deep underline underline-offset-4">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-mocha">First name
            <input name="first_name" required className="field mt-1.5" autoComplete="given-name" />{err("first_name")}
          </label>
          <label className="block text-sm text-mocha">Last name
            <input name="last_name" className="field mt-1.5" autoComplete="family-name" />
          </label>
        </div>
        <label className="block text-sm text-mocha">Email
          <input name="email" type="email" required className="field mt-1.5" autoComplete="email" aria-invalid={Boolean(errors.email)} />{err("email")}
        </label>
        <label className="block text-sm text-mocha">Password
          <input name="password" type="password" required minLength={8} className="field mt-1.5" autoComplete="new-password" aria-invalid={Boolean(errors.password)} />
          <span className="mt-1 block text-xs">At least 8 characters.</span>{err("password")}
        </label>
        <label className="flex items-start gap-2.5 text-sm text-mocha">
          <input name="accepts_marketing" type="checkbox" className="mt-1 h-4 w-4 accent-[#7B4F3A]" /> Email me about new drops and offers
        </label>
        {errors.form && <p className="text-sm text-danger" role="alert">{errors.form}</p>}
        <Button type="submit" full size="lg" loading={busy}>Create account</Button>
      </form>
      <GoogleButton />
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ detail: string }>("/auth/password/reset/", { method: "POST", body: { email: new FormData(event.currentTarget).get("email") } });
      setDone(result.detail);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard
      title="Reset your password" text="Tell us your email and we will send you a link."
      footer={<Link href="/account/login" className="underline underline-offset-4">Back to sign in</Link>}
    >
      {done ? (
        <p className="rounded-2xl bg-cream px-5 py-4 text-center text-deep" role="status">{done}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm text-mocha">Email
            <input name="email" type="email" required className="field mt-1.5" autoComplete="email" />
          </label>
          <Button type="submit" full size="lg" loading={busy}>Send reset link</Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const search = useSearchParams();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ detail: string }>("/auth/password/reset/confirm/", {
        method: "POST", body: { uid: search.get("uid"), token: search.get("token"), password: new FormData(event.currentTarget).get("password") },
      });
      toast.success(result.detail);
      router.replace("/account/login");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-mocha">New password
          <input name="password" type="password" required minLength={8} className="field mt-1.5" autoComplete="new-password" />
        </label>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <Button type="submit" full size="lg" loading={busy}>Update password</Button>
      </form>
    </AuthCard>
  );
}

/** Landing page for the Google OAuth redirect: trades the code for a session. */
export function GoogleCallback() {
  const search = useSearchParams();
  const router = useRouter();
  const afterLogin = useAfterLogin();
  const [error, setError] = useState("");
  useEffect(() => {
    const code = search.get("code");
    if (!code) {
      setError("Google sign-in was cancelled.");
      return;
    }
    api<User>("/auth/google/", { method: "POST", body: { code } })
      .then(async (user) => {
        await afterLogin(user);
        router.replace(sessionStorage.getItem("hh-auth-next") || "/account");
      })
      .catch((e) => setError(errorMessage(e)));
    // Runs once for the code in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <AuthCard title={error ? "Sign-in did not complete" : "Signing you in…"} text={error || "One moment."}>
      {error && <Button href="/account/login" full>Back to sign in</Button>}
    </AuthCard>
  );
}
