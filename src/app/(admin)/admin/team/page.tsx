import { TeamTable } from "@/components/admin/team-table";
import { resolveAdminAccess } from "@/server/admin/guard";
import { listMembers } from "@/server/admin/team";

export const metadata = { title: "Team — Delta admin" };

/**
 * Owner-only: the layout above already gates ADMIN_ROLES generally, but
 * managing roles is narrower than that, so this page checks again itself.
 */
export default async function AdminTeamPage() {
  const access = await resolveAdminAccess();
  const isOwner = access.state === "granted" && access.principal.membership.role === "owner";

  if (!isOwner) {
    return (
      <>
        <div className="admin-header">
          <h1>Team</h1>
        </div>
        <p className="admin-hint">Only an owner can view or manage the team.</p>
      </>
    );
  }

  const members = await listMembers();
  const selfId = access.principal.userId;

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Team</h1>
          <p className="admin-hint">
            There is no invite API available yet — add a member by the Supabase auth user id they already have.
          </p>
        </div>
      </div>
      <TeamTable members={members} selfId={selfId} />
    </>
  );
}
