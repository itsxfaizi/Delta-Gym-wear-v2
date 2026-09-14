"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { StatusSelect } from "@/components/admin/status-select";
import { ADMIN_ROLES } from "@/features/admin/schemas";
import {
  addMemberSchema,
  isLastActiveOwner,
  type MemberRow,
  type addMemberSchema as AddMemberSchema,
} from "@/features/admin/team";
import {
  addMemberAction,
  changeMemberRoleAction,
  setMemberStatusAction,
} from "@/features/admin/team-actions";

type AddMemberInput = import("zod").infer<typeof AddMemberSchema>;

const ROLE_LABELS: Record<(typeof ADMIN_ROLES)[number], string> = {
  owner: "Owner",
  catalog_editor: "Catalog editor",
  publisher: "Publisher",
  auditor: "Auditor",
};

const ROLE_OPTIONS = ADMIN_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

export function TeamTable({ members, selfId }: { members: readonly MemberRow[]; selfId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { authUserId: "", role: "auditor" },
  });

  function run(label: string, action: () => Promise<{ ok: boolean; message?: string }>, authUserId: string) {
    setBusyId(authUserId);
    startTransition(async () => {
      const result = await action();
      setBusyId(null);
      if (!result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success(label);
      router.refresh();
    });
  }

  async function onAdd(values: AddMemberInput) {
    const result = await addMemberAction(values);
    if (!result.ok) {
      toast.error(result.message ?? "That did not work.");
      return;
    }
    toast.success("Member added.");
    reset();
    router.refresh();
  }

  return (
    <div className="admin-stack">
      <form className="admin-card team-add" onSubmit={handleSubmit(onAdd)} noValidate>
        <h2>Add a member</h2>
        <p className="admin-hint">
          They must already have signed in once, so an auth user id exists. Find it in Supabase under
          Authentication → Users.
        </p>
        <div className="admin-field">
          <label htmlFor="member-auth-id">Supabase auth user id</label>
          <input
            id="member-auth-id"
            autoComplete="off"
            placeholder="00000000-0000-0000-0000-000000000000"
            aria-invalid={errors.authUserId ? "true" : "false"}
            aria-describedby={errors.authUserId ? "member-auth-id-error" : undefined}
            {...register("authUserId")}
          />
          {errors.authUserId ? (
            <span className="admin-field-error" id="member-auth-id-error" role="alert">
              {errors.authUserId.message}
            </span>
          ) : null}
        </div>
        <div className="admin-field">
          <label htmlFor="member-role">Role</label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <StatusSelect
                id="member-role"
                value={field.value}
                options={ROLE_OPTIONS}
                disabled={isSubmitting}
                onValueChange={field.onChange}
              />
            )}
          />
        </div>
        <div className="admin-actions">
          <button className="admin-button admin-button--primary" type="submit" disabled={isSubmitting}>
            <UserPlus aria-hidden="true" /> {isSubmitting ? "Adding…" : "Add member"}
          </button>
        </div>
      </form>

      <div className="admin-card">
        <h2>Members</h2>
        {members.length === 0 ? (
          <p className="admin-empty">No members yet.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <caption className="sr-only">Team members and their roles</caption>
              <thead>
                <tr>
                  <th scope="col">Auth user id</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const lastOwner = isLastActiveOwner(members, member.authUserId);
                  const busy = isPending && busyId === member.authUserId;

                  return (
                    <tr key={member.authUserId}>
                      <td>
                        <code className="team-id">{member.authUserId}</code>
                        {member.authUserId === selfId ? <span className="admin-hint"> (you)</span> : null}
                      </td>
                      <td>
                        <StatusSelect
                          id={`role-${member.authUserId}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          disabled={busy || lastOwner}
                          onValueChange={(role) =>
                            run("Role updated.", () => changeMemberRoleAction({ authUserId: member.authUserId, role }), member.authUserId)
                          }
                        />
                      </td>
                      <td>
                        <span className="ops-badge" data-tone={member.status === "active" ? "success" : "warn"}>
                          {member.status === "active" ? "Active" : "Suspended"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="admin-button"
                          type="button"
                          disabled={busy || lastOwner}
                          onClick={() =>
                            run(
                              member.status === "active" ? "Member suspended." : "Member reactivated.",
                              () =>
                                setMemberStatusAction({
                                  authUserId: member.authUserId,
                                  status: member.status === "active" ? "suspended" : "active",
                                }),
                              member.authUserId,
                            )
                          }
                        >
                          {busy ? "Working…" : member.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                        {lastOwner ? (
                          <p className="admin-hint">The last active owner cannot be changed.</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
