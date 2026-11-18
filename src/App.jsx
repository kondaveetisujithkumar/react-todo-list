
import { useState, useEffect } from "react";
import "./App.css";

function App() {

  // 1. Store tasks
  const [tasks, setTasks] = useState(() => {
    try {
      const savedTasks = localStorage.getItem("myTasks");
      return savedTasks ? JSON.parse(savedTasks) : [];
    } catch {
      return [];
    }
  });

  // 2. Store input value
  const [input, setInput] = useState("");

  // 3. Store selected filter
  const [filter, setFilter] = useState("all");

  // 4. Save tasks whenever tasks change
  useEffect(() => {
    localStorage.setItem("myTasks", JSON.stringify(tasks));
  }, [tasks]);

  // 5. Add a task
  function addTask(e) {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

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

  // 6. Mark task as completed or active
  function toggleTask(id) {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    );
  }

  // 7. Delete a task
  function deleteTask(id) {
    setTasks((previousTasks) =>
      previousTasks.filter((task) => task.id !== id)
    );
  }

  // 8. Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filter === "active") {
      return !task.completed;
    }

    if (filter === "completed") {
      return task.completed;
    }

    return true;
  });

  // 9. Calculate task counts
  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingCount = tasks.length - completedCount;

  // 10. Display application
  return (
    <div className="app">

      <div className="container">

        <header className="header">
          <div>
            <h1>My Tasks</h1>
            <p>Stay organised. Get things done.</p>
          </div>

          <div className="header-icon">✓</div>
        </header>

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

        <form onSubmit={addTask} className="task-form">

          <input
            type="text"
            placeholder="Enter your task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button type="submit">+ Add Task</button>

        </form>

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
