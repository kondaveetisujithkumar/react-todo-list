
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./workspace.css";

function Workspace({ onBack }) {
  const [user, setUser] = useState(null);
  const [myWorkspaces, setMyWorkspaces] = useState([]);
  const [publicWorkspaces, setPublicWorkspaces] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!currentUser) throw new Error("Please log in again.");

      setUser(currentUser);

      // Get workspaces where the current user is a member
      const { data: memberships, error: memberError } =
        await supabase
          .from("workspace_members")
          .select("workspace_id, role");

      if (memberError) throw memberError;

      const memberIds = (memberships || []).map(
        (member) => member.workspace_id
      );

      let joined = [];

      if (memberIds.length > 0) {
        const { data, error: workspaceError } = await supabase
          .from("workspaces")
          .select("id, name, description, is_public")
          .in("id", memberIds);

        if (workspaceError) throw workspaceError;

        joined = (data || []).map((workspace) => ({
          ...workspace,
          role:
            memberships.find(
              (member) => member.workspace_id === workspace.id
            )?.role || "member",
        }));
      }

      setMyWorkspaces(joined);

      // Get public workspaces
      const { data: publicData, error: publicError } =
        await supabase
          .from("workspaces")
          .select("id, name, description, is_public")
          .eq("is_public", true)
          .order("name");

      if (publicError) throw publicError;

      setPublicWorkspaces(publicData || []);

      // Get requests submitted by this user
      const { data: requestData, error: requestError } =
        await supabase
          .from("join_requests")
          .select("id, workspace_id, status, requested_at")
          .eq("user_id", currentUser.id)
          .order("requested_at", { ascending: false });

      if (requestError) throw requestError;

      setMyRequests(requestData || []);

      // Get pending requests for workspaces this user administers
      const adminIds = (memberships || [])
        .filter((member) => member.role === "admin")
        .map((member) => member.workspace_id);

      if (adminIds.length > 0) {
        const { data: pending, error: pendingError } =
          await supabase
            .from("join_requests")
            .select("id, workspace_id, user_id, status, requested_at")
            .in("workspace_id", adminIds)
            .eq("status", "pending")
            .order("requested_at", { ascending: true });

        if (pendingError) throw pendingError;

        setAdminRequests(pending || []);
      } else {
        setAdminRequests([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  async function handleCreateWorkspace(e) {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    setError("");

    try {
      const { data, error: createError } = await supabase.rpc(
        "create_workspace",
        {
          p_name: name.trim(),
          p_description: description.trim(),
          p_is_public: isPublic,
        }
      );

      if (createError) throw createError;

      setName("");
      setDescription("");
      setIsPublic(true);
      setMessage("Workspace created successfully!");

      await loadWorkspaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRequest(workspaceId) {
    setMessage("");
    setError("");

    try {
      const { error: requestError } = await supabase
        .from("join_requests")
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          status: "pending",
        });

      if (requestError) throw requestError;

      setMessage("Your join request was sent to the workspace admin.");
      await loadWorkspaces();
    } catch (err) {
      if (err.code === "23505") {
        setError("You have already requested to join this workspace.");
      } else {
        setError(err.message);
      }
    }
  }

  async function handleReviewRequest(requestId, decision) {
    setMessage("");
    setError("");

    try {
      const { error: reviewError } = await supabase.rpc(
        "review_join_request",
        {
          p_request_id: requestId,
          p_decision: decision,
        }
      );

      if (reviewError) throw reviewError;

      setMessage(
        decision === "approved"
          ? "Membership request approved."
          : "Membership request rejected."
      );

      await loadWorkspaces();
    } catch (err) {
      setError(err.message);
    }
  }

  function getRequestStatus(workspaceId) {
    return myRequests.find(
      (request) => request.workspace_id === workspaceId
    )?.status;
  }

  if (loading) {
    return <div className="workspace-page">Loading workspaces...</div>;
  }

  return (
    <div className="workspace-page">
      <div className="workspace-header">
        <div>
          <h1>Workspaces</h1>
          <p>Create a team, discover communities and collaborate.</p>
        </div>

        <button className="workspace-back" onClick={onBack}>
          Back to Tasks
        </button>
      </div>

      {message && <div className="workspace-success">{message}</div>}
      {error && <div className="workspace-error">{error}</div>}

      {/* CREATE WORKSPACE */}
      <section className="workspace-section">
        <h2>Create a Workspace</h2>

        <form onSubmit={handleCreateWorkspace}>
          <label>Workspace Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter workspace name"
            maxLength={80}
            required
          />

          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your workspace"
            maxLength={500}
            rows={3}
          />

          <label className="workspace-checkbox">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            Make this workspace public and discoverable
          </label>

          <button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </section>

      {/* MY WORKSPACES */}
      <section className="workspace-section">
        <h2>My Workspaces</h2>

        {myWorkspaces.length === 0 ? (
          <p>You haven't joined any workspaces yet.</p>
        ) : (
          <div className="workspace-grid">
            {myWorkspaces.map((workspace) => (
              <article className="workspace-card" key={workspace.id}>
                <h3>{workspace.name}</h3>
                <p>{workspace.description || "No description provided."}</p>
                <span className="workspace-role">
                  Your role: {workspace.role}
                </span>
                <span className="workspace-visibility">
                  {workspace.is_public ? "Public" : "Private"}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* DISCOVER WORKSPACES */}
      <section className="workspace-section">
        <h2>Discover Workspaces</h2>

        <div className="workspace-grid">
          {publicWorkspaces
            .filter(
              (workspace) =>
                !myWorkspaces.some(
                  (member) => member.id === workspace.id
                )
            )
            .map((workspace) => {
              const requestStatus = getRequestStatus(workspace.id);

              return (
                <article className="workspace-card" key={workspace.id}>
                  <h3>{workspace.name}</h3>
                  <p>{workspace.description || "No description provided."}</p>

                  {requestStatus === "pending" ? (
                    <span className="workspace-pending">
                      Request Pending
                    </span>
                  ) : requestStatus === "rejected" ? (
                    <span className="workspace-rejected">
                      Request Rejected
                    </span>
                  ) : (
                    <button
                      onClick={() => handleJoinRequest(workspace.id)}
                    >
                      Request to Join
                    </button>
                  )}
                </article>
              );
            })}
        </div>

        {publicWorkspaces.length === 0 && (
          <p>No public workspaces are available yet.</p>
        )}
      </section>

      {/* ADMIN REQUESTS */}
      <section className="workspace-section">
        <h2>Membership Requests</h2>

        {adminRequests.length === 0 ? (
          <p>No pending membership requests.</p>
        ) : (
          adminRequests.map((request) => {
            const workspace = myWorkspaces.find(
              (item) => item.id === request.workspace_id
            );

            return (
              <article className="request-card" key={request.id}>
                <div>
                  <strong>{workspace?.name || "Workspace"}</strong>
                  <p>Applicant user ID: {request.user_id}</p>
                </div>

                <div className="request-actions">
                  <button
                    onClick={() =>
                      handleReviewRequest(request.id, "approved")
                    }
                  >
                    Approve
                  </button>

                  <button
                    className="reject-button"
                    onClick={() =>
                      handleReviewRequest(request.id, "rejected")
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

export default Workspace;
