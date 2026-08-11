"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAgentAction } from "./actions";

export function AddUserPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        + Add user
      </Button>
    );
  }

  return (
    <Card className="glass-panel w-full max-w-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Add user</h2>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <form action={createAgentAction} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input id="new-email" name="email" type="email" required placeholder="email@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-name">Display name</Label>
          <Input id="new-name" name="displayName" required placeholder="Display name" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-role">Role</Label>
          <select
            id="new-role"
            name="role"
            defaultValue="agent"
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
          >
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-password">Password (optional)</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            minLength={6}
            placeholder="Min 6 characters — leave blank for Google-only"
          />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="isContractor" type="checkbox" className="rounded border-input" />
          1099 contractor
        </label>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="new-company">Company (contractors)</Label>
          <Input id="new-company" name="companyName" placeholder="Legal entity name" />
        </div>
        <Button type="submit" size="sm" className="sm:col-span-2 sm:justify-self-end">
          Create
        </Button>
      </form>
    </Card>
  );
}
