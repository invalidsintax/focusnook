/**
 * Todoist API Service
 * Handles all interactions with the Todoist REST API v2
 */

// All requests go through our Express proxy to avoid Todoist's CORS restriction
const API_BASE = `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/todoist`;

/**
 * Make an authenticated request to the Todoist API
 */
async function request(endpoint, token, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            // Proxy reads this header and forwards it as Authorization to Todoist
            'X-Todoist-Token': token,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = new Error(`Todoist API error: ${response.status}`);
        error.status = response.status;
        throw error;
    }

    // Some endpoints return no content (204)
    if (response.status === 204) {
        return null;
    }

    return response.json();
}

/**
 * Validate API token by fetching user projects
 */
export async function validateToken(token) {
    try {
        await request('/projects', token);
        return { valid: true };
    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Get all projects for the user
 */
export async function getProjects(token) {
    const projects = await request('/projects', token);
    return projects.map(project => ({
        id: project.id,
        name: project.name,
        color: project.color,
        isInbox: project.is_inbox_project,
    }));
}

/**
 * Built-in filter options
 */
export const FILTER_OPTIONS = [
    { id: 'today', name: 'Today', type: 'filter' },
    { id: 'all', name: 'All Tasks', type: 'filter' },
];

/**
 * Get all active tasks, optionally filtered
 * @param {string} token - API token
 * @param {object} options - Filter options
 * @param {string} options.filter - Filter type: 'today', 'all', or project ID
 */
export async function getTasks(token, options = {}) {
    const { filter = 'today' } = options;

    let endpoint = '/tasks';
    const params = new URLSearchParams();

    if (filter === 'today') {
        // Use Todoist's filter query for today's tasks
        params.append('filter', 'today');
    } else if (filter !== 'all' && filter) {
        // Filter by project ID
        params.append('project_id', filter);
    }
    // 'all' = no filter, get all tasks

    const queryString = params.toString();
    if (queryString) {
        endpoint += `?${queryString}`;
    }

    const tasks = await request(endpoint, token);
    return tasks.map(task => ({
        id: task.id,
        text: task.content,
        completed: task.is_completed || false,
        todoistId: task.id,
        projectId: task.project_id,
        due: task.due,
    }));
}

/**
 * Create a new task
 * @param {string} token - API token
 * @param {string} content - Task content
 * @param {object} options - Optional parameters
 * @param {string} options.projectId - Project to add task to
 * @param {boolean} options.dueToday - Set due date to today
 */
export async function createTask(token, content, options = {}) {
    const { projectId, dueToday } = options;

    const body = { content };

    if (projectId && projectId !== 'today' && projectId !== 'all') {
        body.project_id = projectId;
    }

    if (dueToday) {
        body.due_string = 'today';
    }

    const task = await request('/tasks', token, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    return {
        id: task.id,
        text: task.content,
        completed: false,
        todoistId: task.id,
        projectId: task.project_id,
        due: task.due,
    };
}

/**
 * Close (complete) a task
 */
export async function closeTask(token, taskId) {
    await request(`/tasks/${taskId}/close`, token, {
        method: 'POST',
    });
}

/**
 * Reopen a task
 */
export async function reopenTask(token, taskId) {
    await request(`/tasks/${taskId}/reopen`, token, {
        method: 'POST',
    });
}

/**
 * Delete a task
 */
export async function deleteTask(token, taskId) {
    await request(`/tasks/${taskId}`, token, {
        method: 'DELETE',
    });
}
