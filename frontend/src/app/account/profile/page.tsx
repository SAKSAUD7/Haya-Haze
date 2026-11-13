"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AccountShell } from "@/components/account/parts";
import { Button } from "@/components/ui/Button";
import { api, errorMessage } from "@/lib/api/client";
import { useUser } from "@/lib/hooks";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { user } = useUser();
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const updated = await api<User>("/auth/user/", {
        method: "PATCH",
        body: {
          first_name: form.get("first_name"), last_name: form.get("last_name"), phone: form.get("phone"),
          accepts_marketing: form.get("accepts_marketing") === "on",
        },
      });
      client.setQueryData(["user"], updated);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setChanging(true);
    try {
      await api("/auth/password/change/", {
        method: "POST",
        body: { old_password: form.get("old_password"), new_password1: form.get("new_password"), new_password2: form.get("new_password") },
      });
      toast.success("Password changed");
      formEl.reset();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChanging(false);
    }
  };

  return (
    <AccountShell title="Your profile">
      {user && (
        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={save} className="space-y-4 rounded-[22px] border hairline bg-white/60 p-6">
            <h2 className="text-2xl">Details</h2>
            <p className="text-sm text-mocha">Signed in as <b className="text-deep">{user.email}</b></p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-mocha">First name
                <input name="first_name" defaultValue={user.first_name} className="field mt-1.5" autoComplete="given-name" />
              </label>
              <label className="block text-sm text-mocha">Last name
                <input name="last_name" defaultValue={user.last_name} className="field mt-1.5" autoComplete="family-name" />
              </label>
            </div>
            <label className="block text-sm text-mocha">Mobile number
              <input name="phone" defaultValue={user.phone} className="field mt-1.5" autoComplete="tel-national" inputMode="numeric" />
            </label>
            <label className="flex items-start gap-2.5 text-sm text-mocha">
              <input name="accepts_marketing" type="checkbox" defaultChecked={user.accepts_marketing} className="mt-1 h-4 w-4 accent-[#7B4F3A]" />
              Email me about new drops, styling notes and offers
            </label>
            <Button type="submit" loading={saving}>Save changes</Button>
          </form>

          <form onSubmit={changePassword} className="space-y-4 rounded-[22px] border hairline bg-white/60 p-6">
            <h2 className="text-2xl">Password</h2>
            <p className="text-sm text-mocha">Signed up with an email code or Google? Use “Forgot password” on the sign-in page to set one.</p>
            <label className="block text-sm text-mocha">Current password
              <input name="old_password" type="password" required className="field mt-1.5" autoComplete="current-password" />
            </label>
            <label className="block text-sm text-mocha">New password
              <input name="new_password" type="password" required minLength={8} className="field mt-1.5" autoComplete="new-password" />
            </label>
            <Button type="submit" variant="outline" loading={changing}>Change password</Button>
          </form>
        </div>
      )}
    </AccountShell>
  );
}
