
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

  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [memberEmail, setMemberEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

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

      const { data: publicData, error: publicError } =
        await supabase
          .from("workspaces")
          .select("id, name, description, is_public")
          .eq("is_public", true)
          .order("name");

      if (publicError) throw publicError;

      setPublicWorkspaces(publicData || []);

      const { data: requestData, error: requestError } =
        await supabase
          .from("join_requests")
          .select("id, workspace_id, status, requested_at")
          .eq("user_id", currentUser.id)
          .order("requested_at", { ascending: false });

      if (requestError) throw requestError;

      setMyRequests(requestData || []);

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
      const { error: createError } = await supabase.rpc(
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

  // Open a workspace and load its members
  async function openWorkspace(workspace) {
    setSelectedWorkspace(workspace);
    setWorkspaceMembers([]);
    setMemberEmail("");
    setMessage("");
    setError("");
    setLoadingMembers(true);

    const { data, error: membersError } = await supabase.rpc(
      "get_workspace_members",
      {
        p_workspace_id: workspace.id,
      }
    );

    if (membersError) {
      setError(membersError.message);
    } else {
      setWorkspaceMembers(data || []);
    }

    setLoadingMembers(false);
  }

  // Admin adds an existing registered user
  async function handleAddMember(e) {
    e.preventDefault();

    if (!selectedWorkspace || !memberEmail.trim()) return;

    setAddingMember(true);
    setMessage("");
    setError("");

    try {
      const { error: addError } = await supabase.rpc(
        "add_workspace_member_by_email",
        {
          p_workspace_id: selectedWorkspace.id,
          p_email: memberEmail.trim(),
        }
      );

      if (addError) throw addError;

      setMessage("Member added successfully!");
      setMemberEmail("");

      await openWorkspace(selectedWorkspace);
      await loadWorkspaces();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingMember(false);
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

  // WORKSPACE MEMBER MANAGEMENT VIEW
  if (selectedWorkspace) {
    return (
      <div className="workspace-page">
        <div className="workspace-header">
          <div>
            <h1>{selectedWorkspace.name}</h1>
            <p>
              {selectedWorkspace.description ||
                "Manage your workspace members."}
            </p>
          </div>

          <button
            className="workspace-back"
            onClick={() => {
              setSelectedWorkspace(null);
              setMessage("");
              setError("");
            }}
          >
            Back to Workspaces
          </button>
        </div>

        {message && <div className="workspace-success">{message}</div>}
        {error && <div className="workspace-error">{error}</div>}

        <section className="workspace-section">
          <h2>Workspace Members</h2>

          {selectedWorkspace.role === "admin" && (
            <form onSubmit={handleAddMember} className="add-member-form">
              <label>Add an existing registered user</label>

              <div className="add-member-row">
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Enter member's registered email"
                  required
                />

                <button type="submit" disabled={addingMember}>
                  {addingMember ? "Adding..." : "Add Member"}
                </button>
              </div>

              <p className="workspace-hint">
                The user must already have an account in this application.
              </p>
            </form>
          )}

          {loadingMembers ? (
            <p>Loading members...</p>
          ) : workspaceMembers.length === 0 ? (
            <p>No members found.</p>
          ) : (
            <div className="member-list">
              {workspaceMembers.map((member) => (
                <article className="member-card" key={member.user_id}>
                  <div className="member-avatar">
                    {(member.full_name || member.email || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="member-details">
                    <strong>{member.full_name || "Team Member"}</strong>
                    <span>{member.email}</span>
                  </div>

                  <span
                    className={`member-role ${
                      member.role === "admin" ? "admin-role" : ""
                    }`}
                  >
                    {member.role}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-section">
          <h2>Tasks</h2>
          <p>
            Member management is ready. Task creation and assignment will be
            added in the next step.
          </p>
        </section>
      </div>
    );
  }

  // MAIN WORKSPACE VIEW
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

                <button
                  className="manage-workspace-button"
                  onClick={() => openWorkspace(workspace)}
                >
                  Manage Workspace
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

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
