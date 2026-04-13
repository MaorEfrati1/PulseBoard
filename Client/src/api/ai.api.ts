import { api } from './axios';
import {
    Message,
    TaskSuggestion,
    BlockerReport,
    ActivitySummary,
} from '../types';

export interface ChatPayload {
    message: string;
    taskId?: string;
    conversationHistory?: Array<{ role: Message['role']; content: string }>;
}

export interface ChatResponse {
    message: Message;
    suggestions?: TaskSuggestion[];
}

const aiApi = {
    chat: (payload: ChatPayload) =>
        api.post<ChatResponse>('/ai/chat', payload).then((r) => r.data),

    suggestTasks: (context: string) =>
        api
            .post<TaskSuggestion[]>('/ai/suggest-tasks', { context })
            .then((r) => r.data),

    analyzeBlocker: (taskId: string, description: string) =>
        api
            .post<BlockerReport>('/ai/analyze-blocker', { taskId, description })
            .then((r) => r.data),

    getActivitySummary: (
        userId: string,
        period: ActivitySummary['period'],
    ) =>
        api
            .get<ActivitySummary>(`/ai/activity-summary/${userId}`, {
                params: { period },
            })
            .then((r) => r.data),
};

export default aiApi;