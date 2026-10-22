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
  createInvitationLinkAction,
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

export function TeamTable({ members, selfId, emailInvitesEnabled = false }: {
  members: readonly MemberRow[];
  selfId: string;
  emailInvitesEnabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");

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

  function run(label: string, action: () => Promise<{ ok: boolean; message?: string }>, authUserId: string, clearLinkOnSuccess = false) {
    setBusyId(authUserId);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.message ?? "That did not work.");
          return;
        }
        if (clearLinkOnSuccess) clearInvitationLink();
        toast.success(label);
        router.refresh();
      } catch {
        toast.error("The team change could not be saved. Check your connection and try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function clearInvitationLink() {
    setInviteUrl(null);
    setCopyStatus("");
  }

  async function onInvite(values: InviteMemberInput, delivery: "link" | "email" = "link") {
    clearInvitationLink();
    setInviteError(null);
    try {
      const result = await (delivery === "link" ? createInvitationLinkAction(values) : inviteMemberAction(values));
      if (!result.ok) {
        setInviteError(result.message ?? "The invitation could not be created. Please try again.");
        return;
      }
      if ("inviteUrl" in result && typeof result.inviteUrl === "string") {
        setInviteUrl(result.inviteUrl);
        toast.success("Invitation link created.");
      } else {
        toast.success("Invitation sent. Access starts after they accept and choose a password.");
      }
      reset();
      router.refresh();
    } catch {
      setInviteError("The invitation could not be created. Check your connection and try again.");
    }
  }

  async function copyInvitationLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Copy is unavailable. Select the invitation link and copy it manually.");
    }
  }

  return (
    <>
      <div className="admin-columns team-top">
        <form className="admin-panel team-add" onSubmit={handleSubmit((values) => onInvite(values))} onChange={clearInvitationLink} noValidate aria-busy={isSubmitting}>
          <h2>Invite a team member</h2>
          <div className="admin-field">
            <label htmlFor="member-email">Email address</label>
            <input
              id="member-email"
              type="email"
              autoComplete="email"
              disabled={isSubmitting}
              placeholder="teammate@example.com"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "member-email-error" : "member-email-help"}
              {...register("email")}
            />
            <span className="admin-hint" id="member-email-help">Create a private invitation link for this email address.</span>
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
                  onValueChange={(value) => { clearInvitationLink(); field.onChange(value); }}
                />
              )}
            />
          </div>
          <div className="admin-actions">
            <button className="admin-button admin-button--primary team-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create invitation link"}
            </button>
            <button className="admin-button" type="button" disabled={isSubmitting || !emailInvitesEnabled} onClick={handleSubmit((values) => onInvite(values, "email"))}>Send invitation email</button>
          </div>
          {!emailInvitesEnabled ? <p className="admin-hint">Email invitations are disabled until delivery is configured. Create a private link and share it with the staff member.</p> : null}
          {inviteError ? <p className="admin-error" role="alert">{inviteError}</p> : null}
          {inviteUrl ? (
            <div className="admin-field">
              <label htmlFor="staff-invitation-link">Staff invitation link</label>
              <input id="staff-invitation-link" type="text" value={inviteUrl} readOnly autoComplete="off" spellCheck={false} aria-describedby="staff-invitation-help" onFocus={(event) => event.currentTarget.select()} />
              <p className="admin-hint" id="staff-invitation-help">Share this one-time link privately with this staff member. They choose a password and set up an authenticator.</p>
              <div className="admin-actions">
                <button className="admin-button" type="button" onClick={copyInvitationLink}>Copy link</button>
                <button className="admin-button" type="button" onClick={clearInvitationLink}>Dismiss link</button>
              </div>
              <p className="admin-hint" role="status">{copyStatus}</p>
            </div>
          ) : null}
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
                          disabled={busy || lastOwner || member.status === "cancelled"}
                          onValueChange={(role) =>
                            run("Role updated.", () => changeMemberRoleAction({ authUserId: member.authUserId, role }), member.authUserId)
                          }
                        />
                      </td>
                      <td data-label="Status">
                        <span className="admin-status team-status" data-state={member.status}>
                          {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : member.status === "cancelled" ? "Cancelled" : "Revoked"}
                        </span>
                      </td>
                      <td className="team-actions" data-label="Actions">
                        <button
                          className={`admin-button team-button${member.status === "active" || member.status === "invited" ? " admin-button--danger" : ""}`}
                          type="button"
                          disabled={busy || lastOwner || member.status === "cancelled"}
                          onClick={() =>
                            run(
                              member.status === "invited" ? "Invitation cancelled." : member.status === "active" ? "Access revoked." : "Access restored.",
                              () =>
                                setMemberStatusAction({
                                  authUserId: member.authUserId,
                                  status: member.status === "suspended" ? "active" : "suspended",
                                }),
                              member.authUserId,
                              member.status === "invited",
                            )
                          }
                        >
                          {busy ? "Working…" : member.status === "cancelled" ? "Invitation cancelled" : member.status === "invited" ? "Cancel invitation" : member.status === "active" ? "Revoke" : "Restore"}
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
