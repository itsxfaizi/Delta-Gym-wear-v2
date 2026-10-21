"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { StatusSelect } from "@/components/admin/status-select";
import { ADMIN_ROLES } from "@/features/admin/schemas";
import {
  inviteMemberSchema,
  isLastActiveOwner,
  type MemberRow,
} from "@/features/admin/team";
import {
  inviteMemberAction,
  changeMemberRoleAction,
  setMemberStatusAction,
} from "@/features/admin/team-actions";

type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/** Wording tracks what the guards actually enforce, not the design mockup. */
const ROLE_NOTES: Record<(typeof ADMIN_ROLES)[number], string> = {
  owner: "Everything, including team membership and role changes.",
  catalog_editor: "Create and edit products, variants and stock. Cannot publish or move orders.",
  publisher: "Publish and archive products, and move orders through the cash-on-delivery flow.",
  auditor: "Read-only: can open every admin screen but change nothing.",
};

/* The mockup shows the raw role key everywhere, matching the reference panel. */
const ROLE_OPTIONS = ADMIN_ROLES.map((role) => ({ value: role, label: role }));

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
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "auditor" },
  });

  function run(label: string, action: () => Promise<{ ok: boolean; message?: string }>, authUserId: string) {
    setBusyId(authUserId);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.message ?? "That did not work.");
          return;
        }
        toast.success(label);
        router.refresh();
      } catch {
        toast.error("The team change could not be saved. Check your connection and try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  async function onInvite(values: InviteMemberInput) {
    try {
      const result = await inviteMemberAction(values);
      if (!result.ok) {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success("Invitation sent. Access starts after they accept and choose a password.");
      reset();
      router.refresh();
    } catch {
      toast.error("The invitation could not be sent. Check your connection and try again.");
    }
  }

  return (
    <>
      <div className="admin-columns team-top">
        <form className="admin-panel team-add" onSubmit={handleSubmit(onInvite)} noValidate>
          <h2>Invite a team member</h2>
          <div className="admin-field">
            <label htmlFor="member-email">Email address</label>
            <input
              id="member-email"
              type="email"
              autoComplete="email"
              placeholder="teammate@example.com"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "member-email-error" : "member-email-help"}
              {...register("email")}
            />
            <span className="admin-hint" id="member-email-help">They will receive a link to accept and set a password.</span>
            {errors.email ? (
              <span className="admin-error" id="member-email-error" role="alert">
                {errors.email.message}
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
            <button className="admin-button admin-button--primary team-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>

        <section className="admin-panel" aria-labelledby="team-roles">
          <h2 id="team-roles">What each role can do</h2>
          <dl className="team-roles">
            {ADMIN_ROLES.map((role) => (
              <div key={role}>
                <dt>{role}</dt>
                <dd>{ROLE_NOTES[role]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="admin-panel team-members" aria-labelledby="team-members">
        <h2 id="team-members">Members</h2>
        {members.length === 0 ? (
          <p className="admin-empty">No members yet.</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table admin-data-table team-table">
              <caption className="sr-only">Team members and their roles</caption>
              <thead>
                <tr>
                  <th scope="col">Member</th>
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
                      <td className="team-id" data-label="Member">
                        {/* The auth user id identifies the row to the server, but an
                            owner reads the account by its email. */}
                        <span className="team-email">{member.email ?? "Account deleted"}</span>
                        {member.authUserId === selfId ? <span className="team-self">&nbsp; · you</span> : null}
                      </td>
                      <td className="team-role-cell" data-label="Role">
                        <StatusSelect
                          id={`role-${member.authUserId}`}
                          label={`Role for ${member.email ?? member.authUserId}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          disabled={busy || lastOwner}
                          onValueChange={(role) =>
                            run("Role updated.", () => changeMemberRoleAction({ authUserId: member.authUserId, role }), member.authUserId)
                          }
                        />
                      </td>
                      <td data-label="Status">
                        <span className="admin-status team-status" data-state={member.status}>
                          {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Revoked"}
                        </span>
                      </td>
                      <td className="team-actions" data-label="Actions">
                        <button
                          className={`admin-button team-button${member.status === "active" ? " admin-button--danger" : ""}`}
                          type="button"
                          disabled={busy || lastOwner || member.status === "invited"}
                          onClick={() =>
                            run(
                              member.status === "active" ? "Access revoked." : "Access restored.",
                              () =>
                                setMemberStatusAction({
                                  authUserId: member.authUserId,
                                  status: member.status === "active" ? "suspended" : "active",
                                }),
                              member.authUserId,
                            )
                          }
                        >
                          {busy ? "Working…" : member.status === "invited" ? "Awaiting acceptance" : member.status === "active" ? "Revoke" : "Restore"}
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
      </section>
    </>
  );
}
