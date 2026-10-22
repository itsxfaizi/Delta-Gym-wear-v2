import { formatDate } from "@/lib/datetime";
import { resolveAdminAccess } from "@/server/admin/guard";
import { listOwnerAuditEvents } from "@/server/admin/audit";

export default async function AdminAuditPage() {
  const access = await resolveAdminAccess();
  if (access.state !== "granted" || access.principal.membership.role !== "owner") {
    return (
      <section className="admin-panel admin-forbidden" role="status">
        <h1>Owner access required</h1>
        <p className="admin-hint">Audit events are available to the store owner only.</p>
      </section>
    );
  }

  const events = await listOwnerAuditEvents();

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>Audit log</h1>
          <p className="admin-hint">Latest {events.length} privileged events · owner access only</p>
        </div>
      </div>
      {events.length === 0 ? (
        <p className="admin-empty">No audit events recorded yet.</p>
      ) : (
        <div className="admin-panel">
          <div className="admin-table-scroll">
            <table className="admin-table admin-data-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Request ID</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <time dateTime={event.createdAt.toISOString()}>{formatDate(event.createdAt)}</time>
                    </td>
                    <td>{event.action}</td>
                    <td>{event.targetType}{event.targetId ? ` · ${event.targetId}` : ""}</td>
                    <td>{event.actorUserId ?? "System"}</td>
                    <td>{event.outcome}</td>
                    <td>{event.requestId ?? event.correlationId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
