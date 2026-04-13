import { api } from './axios';
import { Task, TaskFilters, PaginatedResponse } from '../types';

export interface CreateTaskPayload {
    title: string;
    description?: string;
    priority: Task['priority'];
    assigneeId: string;
    dueDate?: string;
    tags?: string[];
}

export type UpdateTaskPayload = Partial<CreateTaskPayload> & {
    status?: Task['status'];
};

const tasksApi = {
    getAll: (filters?: TaskFilters, page = 1, pageSize = 20) =>
        api
            .get<PaginatedResponse<Task>>('/tasks', {
                params: { ...filters, page, pageSize },
            })
            .then((r) => r.data),

    getById: (id: string) =>
        api.get<Task>(`/tasks/${id}`).then((r) => r.data),

    create: (payload: CreateTaskPayload) =>
        api.post<Task>('/tasks', payload).then((r) => r.data),

    update: (id: string, payload: UpdateTaskPayload) =>
        api.patch<Task>(`/tasks/${id}`, payload).then((r) => r.data),

    remove: (id: string) =>
        api.delete(`/tasks/${id}`).then((r) => r.data),

    bulkUpdate: (ids: string[], payload: UpdateTaskPayload) =>
        api
            .patch<Task[]>('/tasks/bulk', { ids, ...payload })
            .then((r) => r.data),
};

export default tasksApi;