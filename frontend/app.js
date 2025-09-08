// Application State
class AppState {
  constructor() {
    this.user = null;
    this.tasks = [];
    this.taskLogs = [];
    this.attendanceStatus = null;
    this.currentView = "dashboard";
    this.selectedDate = null;
    this.currentCalendarDate = new Date();
    this.departmentUsers = [];
    this.selectedUserId = null;
  }
}

const state = new AppState();

// API Configuration
// app.js or wherever API_BASE_URL is defined
const API_BASE_URL = window.location.origin + "/api";

// Utility Functions
function getAuthToken() {
  return localStorage.getItem("auth_token");
}

function setAuthToken(token) {
  localStorage.setItem("auth_token", token);
}

function removeAuthToken() {
  localStorage.removeItem("auth_token");
}

async function apiRequest(method, endpoint, data = null) {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Toast Notifications
function showToast(title, description, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-description">${description}</div>
    `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// Page Navigation
function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");
}

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.remove("active");
  });
  document.getElementById(`${viewId}-view`).classList.add("active");

  // Update navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
  document.querySelector(`[data-view="${viewId}"]`).classList.add("active");

  // Update page title
  const titles = {
    dashboard: "Dashboard",
    kanban: "Kanban Board",
    calendar: "Calendar",
    "task-performed": "Task Performed",
    wfh: "WFH Requests",
    approvals: "Task Approvals",
  };
  document.getElementById("page-title").textContent =
    titles[viewId] || "Dashboard";

  state.currentView = viewId;

  // Load view-specific data
  loadViewData(viewId);
}

// Authentication
async function login(email, password) {
  try {
    const response = await apiRequest("POST", "/auth/login", {
      email,
      password,
    });
    setAuthToken(response.token);
    state.user = response.user;
    await loadUserProfile();
    showPage("dashboard-page");
    setupUserInterface();
    loadDashboardData();
    showToast("Welcome!", "Successfully logged in.");
  } catch (error) {
    showToast("Login Failed", error.message, "error");
  }
}

async function loadUserProfile() {
  try {
    const user = await apiRequest("GET", "/user/profile");
    state.user = user;
    state.selectedUserId = user.id;
    return user;
  } catch (error) {
    console.error("Failed to load user profile:", error);
    logout();
  }
}

function logout() {
  removeAuthToken();
  state.user = null;
  state.tasks = [];
  state.taskLogs = [];
  showPage("login-page");
  showToast("Goodbye!", "Successfully logged out.");
}

function setupUserInterface() {
  if (!state.user) return;

  // Update user info in sidebar
  document.getElementById("user-name").textContent = state.user.name;
  document.getElementById("user-role").textContent = state.user.role;
  document.getElementById("user-department").textContent =
    state.user.department || "Department";

  // Set user initials
  const initials = state.user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  document.getElementById("user-initials").textContent = initials;

  // Show/hide role-specific features
  const isHOD = state.user.role === "HOD" || state.user.role === "Super Admin";
  const isAdmin = state.user.role === "Super Admin";
  const isEmployee = state.user.role === "Employee";

  // HOD features
  document.querySelectorAll(".hod-features").forEach((el) => {
    el.style.display = isHOD ? "block" : "none";
  });

  // Admin features
  document.querySelectorAll(".admin-features").forEach((el) => {
    el.style.display = isAdmin ? "block" : "none";
  });

  // Hide WFH for Super Admin
  document.querySelector(".wfh-section").style.display = isAdmin
    ? "none"
    : "block";

  // Hide task creation for employees
  document.getElementById("add-task-btn").style.display = isEmployee
    ? "none"
    : "block";
  document.getElementById("assigned-by-me-option").style.display = isEmployee
    ? "none"
    : "block";

  // Show employee selector for HOD/Admin in calendar
  document.getElementById("employee-select").style.display = isEmployee
    ? "none"
    : "block";
}

// Data Loading Functions
async function loadViewData(viewId) {
  switch (viewId) {
    case "dashboard":
      await loadDashboardData();
      break;
    case "kanban":
      await loadKanbanData();
      break;
    case "calendar":
      await loadCalendarData();
      break;
    case "task-performed":
      await loadTaskLogsData();
      break;
    case "wfh":
      await loadWFHData();
      break;
    case "approvals":
      await loadApprovalsData();
      break;
  }
}

async function loadDashboardData() {
  try {
    const [tasks, attendance] = await Promise.all([
      apiRequest("GET", "/tasks"),
      apiRequest("GET", "/attendance/status"),
    ]);

    state.tasks = tasks;
    state.attendanceStatus = attendance;

    updateDashboardStats();
    updateAttendanceStatus();
    renderRecentTasks();
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  }
}

async function loadKanbanData() {
  try {
    const [tasks, departmentUsers] = await Promise.all([
      apiRequest("GET", "/tasks"),
      state.user.role !== "Employee"
        ? apiRequest("GET", `/departments/${state.user.departmentId}/users`)
        : Promise.resolve([]),
    ]);

    state.tasks = tasks;
    state.departmentUsers = departmentUsers;

    renderKanbanBoard();
    setupKanbanFilters();
  } catch (error) {
    console.error("Failed to load kanban data:", error);
  }
}

async function loadCalendarData() {
  try {
    const [tasks, taskLogs, departmentUsers] = await Promise.all([
      apiRequest("GET", "/tasks"),
      apiRequest("GET", `/task-logs/${state.selectedUserId}`),
      state.user.role !== "Employee"
        ? apiRequest("GET", `/departments/${state.user.departmentId}/users`)
        : Promise.resolve([]),
    ]);

    state.tasks = tasks;
    state.taskLogs = taskLogs;
    state.departmentUsers = departmentUsers;

    renderCalendar();
    setupEmployeeSelector();
  } catch (error) {
    console.error("Failed to load calendar data:", error);
  }
}

async function loadTaskLogsData() {
  try {
    const taskLogs = await apiRequest("GET", `/task-logs/${state.user.id}`);
    state.taskLogs = taskLogs;

    renderTaskLogs();
    setupDateFilter();
  } catch (error) {
    console.error("Failed to load task logs:", error);
  }
}

async function loadWFHData() {
  try {
    const wfhRequests = await apiRequest("GET", "/wfh");
    renderWFHRequests(wfhRequests);
  } catch (error) {
    console.error("Failed to load WFH data:", error);
  }
}

async function loadApprovalsData() {
  try {
    const approvals = await apiRequest("GET", "/approvals");
    renderApprovals(approvals);
  } catch (error) {
    console.error("Failed to load approvals:", error);
  }
}

// Dashboard Functions
function updateDashboardStats() {
  const stats = calculateTaskStats(state.tasks);

  document.getElementById("total-tasks").textContent = stats.total;
  document.getElementById("completed-tasks").textContent = stats.completed;
  document.getElementById("in-progress-tasks").textContent = stats.inProgress;
  document.getElementById("overdue-tasks").textContent = stats.overdue;
}

function calculateTaskStats(tasks) {
  const now = new Date();

  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "Done").length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    overdue: tasks.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now && t.status !== "Done";
    }).length,
  };
}

function renderRecentTasks() {
  const container = document.getElementById("recent-tasks-list");
  const recentTasks = state.tasks.slice(0, 5);

  if (recentTasks.length === 0) {
    container.innerHTML = '<p class="no-data">No recent tasks</p>';
    return;
  }

  container.innerHTML = recentTasks
    .map(
      (task) => `
        <div class="task-item">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span class="priority-badge ${task.priority.toLowerCase()}">${
        task.priority
      }</span>
                <span class="status-badge ${task.status
                  .toLowerCase()
                  .replace(" ", "-")}">${task.status}</span>
            </div>
        </div>
    `
    )
    .join("");
}

// Attendance Functions
function updateAttendanceStatus() {
  const statusElement = document.getElementById("attendance-status");
  const toggleButton = document.getElementById("attendance-toggle");

  if (state.attendanceStatus?.isCheckedIn) {
    statusElement.textContent = "Checked In";
    statusElement.className = "status-badge checked-in";
    toggleButton.innerHTML = '<i class="fas fa-clock"></i> Check Out';
  } else {
    statusElement.textContent = "Checked Out";
    statusElement.className = "status-badge checked-out";
    toggleButton.innerHTML = '<i class="fas fa-clock"></i> Check In';
  }
}

async function toggleAttendance() {
  try {
    const endpoint = state.attendanceStatus?.isCheckedIn
      ? "/attendance/checkout"
      : "/attendance/checkin";
    await apiRequest("POST", endpoint);

    // Reload attendance status
    state.attendanceStatus = await apiRequest("GET", "/attendance/status");
    updateAttendanceStatus();

    const message = state.attendanceStatus?.isCheckedIn
      ? "Checked in successfully"
      : "Checked out successfully";
    showToast("Attendance Updated", message);
  } catch (error) {
    showToast("Attendance Error", error.message, "error");
  }
}

// Kanban Functions
function renderKanbanBoard() {
  const filteredTasks = filterTasks();
  const tasksByStatus = groupTasksByStatus(filteredTasks);

  // Update task counts
  document.querySelector('[data-status="To Do"] .task-count').textContent =
    tasksByStatus["To Do"].length;
  document.querySelector(
    '[data-status="In Progress"] .task-count'
  ).textContent = tasksByStatus["In Progress"].length;
  document.querySelector('[data-status="Done"] .task-count').textContent =
    tasksByStatus["Done"].length;

  // Render tasks in columns
  renderTaskColumn("todo-tasks", tasksByStatus["To Do"]);
  renderTaskColumn("progress-tasks", tasksByStatus["In Progress"]);
  renderTaskColumn("done-tasks", tasksByStatus["Done"]);
}

function filterTasks() {
  const filter = document.getElementById("task-filter").value;

  return state.tasks.filter((task) => {
    switch (filter) {
      case "my-tasks":
        return task.assignees?.some((a) => a.assigneeId === state.user.id);
      case "assigned-by-me":
        return task.assignerId === state.user.id;
      default:
        return true;
    }
  });
}

function groupTasksByStatus(tasks) {
  return {
    "To Do": tasks.filter((t) => t.status === "To Do"),
    "In Progress": tasks.filter((t) => t.status === "In Progress"),
    Done: tasks.filter((t) => t.status === "Done"),
  };
}

function renderTaskColumn(containerId, tasks) {
  const container = document.getElementById(containerId);

  if (tasks.length === 0) {
    container.innerHTML = '<p class="no-data">No tasks</p>';
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
        <div class="task-card" draggable="true" data-task-id="${task.id}">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span class="priority-badge ${task.priority.toLowerCase()}">${
        task.priority
      }</span>
                <span class="task-date">${
                  task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString()
                    : "No due date"
                }</span>
            </div>
        </div>
    `
    )
    .join("");

  // Add drag and drop event listeners
  container.querySelectorAll(".task-card").forEach((card) => {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
  });
}

function setupKanbanFilters() {
  document
    .getElementById("task-filter")
    .addEventListener("change", renderKanbanBoard);
}

// Drag and Drop for Kanban
function handleDragStart(e) {
  e.target.classList.add("dragging");
  e.dataTransfer.setData("text/plain", e.target.dataset.taskId);
}

function handleDragEnd(e) {
  e.target.classList.remove("dragging");
}

async function handleTaskMove(taskId, newStatus) {
  try {
    await apiRequest("PATCH", `/tasks/${taskId}`, { status: newStatus });

    // Update local state
    const task = state.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = newStatus;
    }

    renderKanbanBoard();
    showToast("Task Updated", "Task status updated successfully");
  } catch (error) {
    showToast(
      "Update Failed",
      "You don't have permission to move this task",
      "error"
    );
  }
}

// Calendar Functions
function renderCalendar() {
  const calendarGrid = document.getElementById("calendar-grid");
  const monthYear = document.getElementById("current-month");

  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  monthYear.textContent = new Date(year, month).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  let calendarHTML = "";

  // Empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarHTML += '<div class="calendar-day"></div>';
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = isDateToday(date);
    const isSelected =
      state.selectedDate && isSameDate(date, state.selectedDate);
    const tasksForDay = getTasksForDate(date);
    const logsForDay = getTaskLogsForDate(date);

    calendarHTML += `
            <div class="calendar-day ${isToday ? "today" : ""} ${
      isSelected ? "selected" : ""
    }" 
                 data-date="${date.toISOString()}">
                <div class="day-number ${isToday ? "today" : ""}">${day}</div>
                <div class="day-tasks">
                    ${tasksForDay
                      .slice(0, 1)
                      .map(
                        (task) => `
                        <div class="task-preview ${task.priority.toLowerCase()}">${
                          task.title
                        }</div>
                    `
                      )
                      .join("")}
                    ${logsForDay
                      .slice(0, 2)
                      .map(
                        (log) => `
                        <div class="task-preview log">✓ ${log.description.substring(
                          0,
                          20
                        )}${log.description.length > 20 ? "..." : ""}</div>
                    `
                      )
                      .join("")}
                    ${
                      tasksForDay.length + logsForDay.length > 3
                        ? `
                        <div class="task-overflow">+${
                          tasksForDay.length + logsForDay.length - 3
                        } more</div>
                    `
                        : ""
                    }
                </div>
            </div>
        `;
  }

  calendarGrid.innerHTML = calendarHTML;

  // Add click event listeners
  calendarGrid.querySelectorAll(".calendar-day[data-date]").forEach((day) => {
    day.addEventListener("click", (e) => {
      const date = new Date(e.currentTarget.dataset.date);
      selectCalendarDate(date);
    });
  });
}

function getTasksForDate(date) {
  return state.tasks.filter((task) => {
    if (!task.dueDate) return false;
    const taskDate = new Date(task.dueDate);
    const isRelevantTask =
      state.user.role === "Employee"
        ? task.assignees?.some((a) => a.assigneeId === state.user.id)
        : task.assignees?.some((a) => a.assigneeId === state.selectedUserId);

    return isRelevantTask && isSameDate(taskDate, date);
  });
}

function getTaskLogsForDate(date) {
  return state.taskLogs.filter((log) => {
    if (!log.date) return false;
    const logDate = new Date(log.date);
    return isSameDate(logDate, date);
  });
}

function selectCalendarDate(date) {
  state.selectedDate = date;
  renderCalendar();
  renderSelectedDateDetails();
}

function renderSelectedDateDetails() {
  const titleElement = document.getElementById("selected-date-title");
  const contentElement = document.getElementById("selected-date-content");

  if (!state.selectedDate) {
    titleElement.textContent = "Select a Date";
    contentElement.innerHTML =
      '<p class="no-data">Click on a date to view tasks and performance logs</p>';
    return;
  }

  const tasksForDate = getTasksForDate(state.selectedDate);
  const logsForDate = getTaskLogsForDate(state.selectedDate);

  titleElement.textContent = state.selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  let content = "";

  // Assigned Tasks
  content += `
        <div class="detail-section">
            <h4><i class="fas fa-tasks mr-2"></i>Assigned Tasks</h4>
            ${
              tasksForDate.length > 0
                ? tasksForDate
                    .map(
                      (task) => `
                <div class="task-detail">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="status-badge ${task.status
                          .toLowerCase()
                          .replace(" ", "-")}">${task.status}</span>
                        <span class="priority-badge ${task.priority.toLowerCase()}">${
                        task.priority
                      }</span>
                    </div>
                </div>
            `
                    )
                    .join("")
                : '<p class="no-data">No assigned tasks</p>'
            }
        </div>
    `;

  // Task Logs
  content += `
        <div class="detail-section">
            <h4><i class="fas fa-check-circle mr-2"></i>Tasks Performed</h4>
            ${
              logsForDate.length > 0
                ? logsForDate
                    .map(
                      (log) => `
                <div class="log-detail">
                    <div class="log-description">${log.description}</div>
                    <div class="log-meta">
                        ${
                          log.startTime && log.endTime
                            ? `
                            <span>${new Date(log.startTime).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )} - 
                            ${new Date(log.endTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}</span>
                        `
                            : ""
                        }
                        ${
                          log.durationMinutes
                            ? `
                            <span>${Math.floor(log.durationMinutes / 60)}h ${
                                log.durationMinutes % 60
                              }m</span>
                        `
                            : ""
                        }
                    </div>
                </div>
            `
                    )
                    .join("")
                : '<p class="no-data">No tasks performed</p>'
            }
        </div>
    `;

  contentElement.innerHTML = content;
}

function setupEmployeeSelector() {
  const selector = document.getElementById("employee-select");

  if (state.user.role === "Employee") {
    selector.style.display = "none";
    return;
  }

  selector.innerHTML = `
        <option value="${state.user.id}">My Tasks</option>
        ${state.departmentUsers
          .map(
            (user) => `
            <option value="${user.id}">${user.name}</option>
        `
          )
          .join("")}
    `;

  selector.value = state.selectedUserId;

  selector.addEventListener("change", async (e) => {
    state.selectedUserId = e.target.value;
    await loadCalendarData();
  });
}

// Task Logs Functions
function renderTaskLogs() {
  const today = new Date().toISOString().split("T")[0];
  const dateFilter = document.getElementById("date-filter");

  if (!dateFilter.value) {
    dateFilter.value = today;
  }

  renderDateLogs();
  renderRecentLogs();
}

function renderDateLogs() {
  const container = document.getElementById("date-logs");
  const titleElement = document.getElementById("logs-date-title");
  const selectedDate = document.getElementById("date-filter").value;

  if (!selectedDate) {
    container.innerHTML = '<p class="no-data">Select a date to view logs</p>';
    return;
  }

  const date = new Date(selectedDate);
  titleElement.textContent = `Tasks for ${date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  const logsForDate = state.taskLogs.filter((log) => {
    const logDate = new Date(log.date);
    return isSameDate(logDate, date);
  });

  if (logsForDate.length === 0) {
    container.innerHTML =
      '<p class="no-data">No tasks logged for this date</p>';
    return;
  }

  container.innerHTML = logsForDate
    .map(
      (log) => `
        <div class="log-item performed">
            <div class="log-description">${log.description}</div>
            <div class="log-meta">
                ${
                  log.startTime && log.endTime
                    ? `
                    <div class="log-time">
                        <span><i class="fas fa-clock"></i> ${new Date(
                          log.startTime
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })} - 
                        ${new Date(log.endTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}</span>
                        ${
                          log.durationMinutes
                            ? `<span><i class="fas fa-stopwatch"></i> ${Math.floor(
                                log.durationMinutes / 60
                              )}h ${log.durationMinutes % 60}m</span>`
                            : ""
                        }
                    </div>
                `
                    : ""
                }
                <span><i class="fas fa-calendar"></i> ${new Date(
                  log.createdAt
                ).toLocaleDateString()}</span>
            </div>
        </div>
    `
    )
    .join("");
}

function renderRecentLogs() {
  const container = document.getElementById("recent-logs");
  const recentLogs = state.taskLogs.slice(0, 5);

  if (recentLogs.length === 0) {
    container.innerHTML = '<p class="no-data">No task logs yet</p>';
    return;
  }

  container.innerHTML = recentLogs
    .map(
      (log) => `
        <div class="log-item">
            <div class="log-description">
                ${
                  log.description.length > 50
                    ? `${log.description.substring(0, 50)}...`
                    : log.description
                }
            </div>
            <div class="log-meta">
                <span>${new Date(log.date).toLocaleDateString()}</span>
                ${
                  log.durationMinutes
                    ? `<span>${Math.floor(log.durationMinutes / 60)}h ${
                        log.durationMinutes % 60
                      }m</span>`
                    : ""
                }
            </div>
        </div>
    `
    )
    .join("");
}

function setupDateFilter() {
  document
    .getElementById("date-filter")
    .addEventListener("change", renderDateLogs);
}

// Modal Functions
function showModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

// Task Creation
async function createTask(taskData) {
  try {
    await apiRequest("POST", "/tasks", taskData);
    hideModal("task-modal");
    showToast("Task Created", "Task created successfully");

    // Refresh current view
    loadViewData(state.currentView);
  } catch (error) {
    showToast("Creation Failed", error.message, "error");
  }
}

// Task Log Creation
async function createTaskLog(logData) {
  try {
    // Calculate duration if both times are provided
    if (logData.startTime && logData.endTime) {
      const start = new Date(`${logData.date}T${logData.startTime}`);
      const end = new Date(`${logData.date}T${logData.endTime}`);
      logData.durationMinutes = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60)
      );
      logData.startTime = start.toISOString();
      logData.endTime = end.toISOString();
    }

    logData.date = new Date(logData.date).toISOString();

    await apiRequest("POST", "/task-logs", logData);
    hideModal("task-log-modal");
    showToast("Task Logged", "Task logged successfully");

    // Refresh task logs
    await loadTaskLogsData();
  } catch (error) {
    showToast("Logging Failed", error.message, "error");
  }
}

// Utility Date Functions
function isDateToday(date) {
  const today = new Date();
  return isSameDate(date, today);
}

function isSameDate(date1, date2) {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

// Demo Login Function
function fillLogin(email, password) {
  document.getElementById("email").value = email;
  document.getElementById("password").value = password;
}

// Event Listeners
document.addEventListener("DOMContentLoaded", function () {
  // Check if user is already logged in
  if (getAuthToken()) {
    loadUserProfile().then(() => {
      if (state.user) {
        showPage("dashboard-page");
        setupUserInterface();
        loadDashboardData();
      }
    });
  }

  // Login form
  document
    .getElementById("login-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      await login(email, password);
    });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", logout);

  // Navigation
  document.querySelectorAll(".nav-item[data-view]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showView(e.currentTarget.dataset.view);
    });
  });

  // Sidebar toggle
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Attendance toggle
  document
    .getElementById("attendance-toggle")
    .addEventListener("click", toggleAttendance);

  // Modal close buttons
  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      modal.classList.remove("active");
    });
  });

  // Task modal
  document.getElementById("add-task-btn").addEventListener("click", () => {
    showModal("task-modal");
  });

  document.getElementById("cancel-task").addEventListener("click", () => {
    hideModal("task-modal");
  });

  document.getElementById("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const taskData = Object.fromEntries(formData);

    // Add assignees (this would need to be implemented based on UI)
    taskData.assigneeIds = []; // You'd collect these from checkboxes

    await createTask(taskData);
  });

  // Task log modal
  document.getElementById("log-task-btn").addEventListener("click", () => {
    // Set today's date as default
    document.getElementById("log-date").value = new Date()
      .toISOString()
      .split("T")[0];
    showModal("task-log-modal");
  });

  document.getElementById("cancel-log").addEventListener("click", () => {
    hideModal("task-log-modal");
  });

  document
    .getElementById("task-log-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const logData = Object.fromEntries(formData);
      await createTaskLog(logData);
    });

  // Calendar navigation
  document.getElementById("prev-month").addEventListener("click", () => {
    state.currentCalendarDate.setMonth(
      state.currentCalendarDate.getMonth() - 1
    );
    renderCalendar();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    state.currentCalendarDate.setMonth(
      state.currentCalendarDate.getMonth() + 1
    );
    renderCalendar();
  });

  // Drag and drop for kanban
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    const column = e.target.closest(".kanban-column");
    if (column) {
      const taskId = e.dataTransfer.getData("text/plain");
      const newStatus = column.dataset.status;
      if (taskId && newStatus) {
        handleTaskMove(taskId, newStatus);
      }
    }
  });

  // Modal backdrop clicks
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });
  });
});

// Additional functions for WFH and Approvals would go here
function renderWFHRequests(requests) {
  // Implementation for WFH requests rendering
}

function renderApprovals(approvals) {
  // Implementation for approvals rendering
}
