// ─── Auth ────────────────────────────────────────────────────────────────────

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface User {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    role: 'admin' | 'manager' | 'employee';
    createdAt: string;
    updatedAt: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string;
    assignee?: User;
    dueDate?: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

export interface TaskFilters {
    status?: TaskStatus | TaskStatus[];
    priority?: TaskPriority | TaskPriority[];
    assigneeId?: string;
    tags?: string[];
    search?: string;
    dueBefore?: string;
    dueAfter?: string;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    taskId?: string;
    createdAt: string;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export type ActivityAction =
    | 'task_created'
    | 'task_updated'
    | 'task_completed'
    | 'task_blocked'
    | 'comment_added'
    | 'status_changed';

export interface ActivityLog {
    id: string;
    userId: string;
    user?: User;
    action: ActivityAction;
    entityId: string;
    entityType: 'task' | 'message';
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export interface ActivitySummary {
    userId: string;
    period: 'day' | 'week' | 'month';
    completedTasks: number;
    createdTasks: number;
    blockedTasks: number;
    averageCompletionTimeHours: number;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface TaskSuggestion {
    title: string;
    description: string;
    priority: TaskPriority;
    estimatedHours: number;
    reasoning: string;
}

export interface BlockerReport {
    taskId: string;
    blockerDescription: string;
    suggestedActions: string[];
    severity: 'low' | 'medium' | 'high';
    generatedAt: string;
}

// ─── Offline / Sync ──────────────────────────────────────────────────────────

export type QueuedActionType = 'create' | 'update' | 'delete';

export interface QueuedAction {
    id: string;
    type: QueuedActionType;
    endpoint: string;
    payload?: unknown;
    retries: number;
    createdAt: string;
}

export interface SyncResult {
    synced: number;
    failed: number;
    errors: Array<{ actionId: string; message: string }>;
}

export type NetworkStatus = 'online' | 'offline' | 'reconnecting';

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
}