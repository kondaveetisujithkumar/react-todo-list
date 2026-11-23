
import { useState, useEffect } from "react";
import "./App.css";

import Auth from "./components/Auth";
import Workspace from "./components/Workspace";
import { supabase } from "./lib/supabaseClient";

// Main application
function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check whether a user is already logged in
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (mounted) {
        if (error) {
          console.error(error.message);
        }

        setSession(data?.session ?? null);
        setCheckingSession(false);
      }
    }

    checkSession();

    // Listen for login and logout changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setCheckingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Show loading while checking login
  if (checkingSession) {
    return <p>Checking login...</p>;
  }

  // Show login page if user is not logged in
  if (!session) {
    return <Auth />;
  }

  // Show dashboard after login
  return <Dashboard user={session.user} />;
}

// Existing To-Do dashboard
function Dashboard({ user }) {
  const userId = user.id;

  // Workspace navigation state
  const [showWorkspaces, setShowWorkspaces] = useState(false);

  // Task states - separate storage for each user
  const [tasks, setTasks] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`myTasks_${userId}`)
      ) || [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("all");

  // User details form states
  const [formData, setFormData] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`userDetails_${userId}`)
      ) || {
        name: user.user_metadata?.full_name || "",
        phone: "",
        email: user.email || "",
        blocker: ""
      };
    } catch {
      return {
        name: user.user_metadata?.full_name || "",
        phone: "",
        email: user.email || "",
        blocker: ""
      };
    }
  });

  const [savedDetails, setSavedDetails] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`userDetails_${userId}`)
      );
    } catch {
      return null;
    }
  });

  // Save tasks for this logged-in user
  useEffect(() => {
    localStorage.setItem(
      `myTasks_${userId}`,
      JSON.stringify(tasks)
    );
  }, [tasks, userId]);

  // Handle form input changes
  function handleFormChange(e) {
    const { name, value } = e.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value
    }));
  }

  // Submit user details
  function handleFormSubmit(e) {
    e.preventDefault();

    const details = { ...formData };

    localStorage.setItem(
      `userDetails_${userId}`,
      JSON.stringify(details)
    );

    setSavedDetails(details);

    alert("Form submitted successfully!");
  }

  // Add task
  function addTask(e) {
    e.preventDefault();

    if (!input.trim()) return;

    const newTask = {
      id: crypto.randomUUID(),
      text: input.trim(),
      completed: false
    };

    setTasks((previousTasks) => [
      ...previousTasks,
      newTask
    ]);

    setInput("");
  }

  // Complete or activate task
  function toggleTask(id) {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  }

  // Delete task
  function deleteTask(id) {
    setTasks((previousTasks) =>
      previousTasks.filter((task) => task.id !== id)
    );
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingCount = tasks.length - completedCount;

  // Logout
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
    }
  }

  // Show workspace page
  if (showWorkspaces) {
    return (
      <Workspace
        onBack={() => setShowWorkspaces(false)}
      />
    );
  }

  return (
    <div className="app">
      <div className="container">

        {/* HEADER */}
        <header className="header">
          <div>
            <h1>My Tasks</h1>
            <p>Stay organised. Get things done.</p>
            <p>Logged in as: {user.email}</p>
          </div>

          <div style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap"
          }}>
            <button
              type="button"
              onClick={() => setShowWorkspaces(true)}
              style={{
                padding: "10px 18px",
                background: "#3563e9",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Workspaces
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "10px 18px",
                background: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* USER DETAILS FORM */}
        <section className="details-section">
          <h2>User Details</h2>
          <p>Enter your details and mention any blockers.</p>

          <form
            onSubmit={handleFormSubmit}
            className="details-form"
          >
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter email address"
                value={formData.email}
                onChange={handleFormChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="blocker">Blocker</label>
              <textarea
                id="blocker"
                name="blocker"
                placeholder="What is preventing you from completing your work?"
                value={formData.blocker}
                onChange={handleFormChange}
                rows="3"
              />
            </div>

            <button
              type="submit"
              className="submit-button"
            >
              Submit Details
            </button>
          </form>

          {savedDetails && (
            <div className="saved-details">
              <h3>Submitted Details</h3>
              <p>
                <strong>Name:</strong> {savedDetails.name}
              </p>
              <p>
                <strong>Phone:</strong> {savedDetails.phone}
              </p>
              <p>
                <strong>Email:</strong> {savedDetails.email}
              </p>
              <p>
                <strong>Blocker:</strong>{" "}
                {savedDetails.blocker || "None"}
              </p>
            </div>
          )}
        </section>

        {/* TASK STATISTICS */}
        <div className="stats">
          <div className="stat-card">
            <h2>{tasks.length}</h2>
            <p>Total Tasks</p>
          </div>

          <div className="stat-card">
            <h2>{completedCount}</h2>
            <p>Completed</p>
          </div>

          <div className="stat-card">
            <h2>{pendingCount}</h2>
            <p>Pending</p>
          </div>
        </div>

        {/* ADD TASK FORM */}
        <form onSubmit={addTask} className="task-form">
          <input
            type="text"
            placeholder="Enter your task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button type="submit">+ Add Task</button>
        </form>

        {/* FILTERS */}
        <div className="filters">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>

          <button
            className={filter === "active" ? "selected" : ""}
            onClick={() => setFilter("active")}
          >
            Active
          </button>

          <button
            className={filter === "completed" ? "selected" : ""}
            onClick={() => setFilter("completed")}
          >
            Completed
          </button>
        </div>

        {/* TASK LIST */}
        <div className="task-list">
          {filteredTasks.length === 0 ? (
            <p className="empty">
              No tasks found. Add your first task!
            </p>
          ) : (
            filteredTasks.map((task) => (
              <div className="task-item" key={task.id}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                />

                <span className={task.completed ? "done" : ""}>
                  {task.text}
                </span>

                <button
                  className="delete"
                  onClick={() => deleteTask(task.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
