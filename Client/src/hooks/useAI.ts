import { useState, useCallback, useRef } from 'react';

import aiApi, { ChatPayload, ChatResponse } from '../api/ai.api';
import {
  Message,
  TaskSuggestion,
  BlockerReport,
  ActivitySummary,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseAIReturn {
  // Chat
  messages: Message[];
  isChatLoading: boolean;
  chatError: string | null;
  sendMessage: (
    content: string,
    taskId?: string,
  ) => Promise<ChatResponse | null>;
  clearMessages: () => void;

  // Task suggestions
  suggestions: TaskSuggestion[];
  isSuggestionsLoading: boolean;
  suggestionsError: string | null;
  getSuggestions: (context: string) => Promise<TaskSuggestion[]>;
  clearSuggestions: () => void;

  // Blocker analysis
  blockerReport: BlockerReport | null;
  isBlockerLoading: boolean;
  blockerError: string | null;
  analyzeBlocker: (
    taskId: string,
    description: string,
  ) => Promise<BlockerReport | null>;
  clearBlockerReport: () => void;

  // Activity summary
  activitySummary: ActivitySummary | null;
  isActivitySummaryLoading: boolean;
  activitySummaryError: string | null;
  getActivitySummary: (
    userId: string,
    period: ActivitySummary['period'],
  ) => Promise<ActivitySummary | null>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAI(): UseAIReturn {
  const isMountedRef = useRef(true);

  // ── Chat ────────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, taskId?: string): Promise<ChatResponse | null> => {
      setIsChatLoading(true);
      setChatError(null);

      // Build conversation history from current messages
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const payload: ChatPayload = {
        message: content,
        taskId,
        conversationHistory,
      };

      // Optimistic user message (no real id yet)
      const optimisticUserMsg: Message = {
        id: `temp_${Date.now()}`,
        role: 'user',
        content,
        taskId,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const response = await aiApi.chat(payload);

        if (!isMountedRef.current) return null;

        // Replace optimistic message with the real one and append assistant reply
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticUserMsg.id),
          response.message.role === 'user' ? response.message : optimisticUserMsg,
          ...(response.message.role === 'assistant' ? [response.message] : []),
        ]);

        return response;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const message = err instanceof Error ? err.message : 'Failed to send message';
        setChatError(message);

        // Remove optimistic message on failure
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticUserMsg.id),
        );
        return null;
      } finally {
        if (isMountedRef.current) setIsChatLoading(false);
      }
    },
    [messages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setChatError(null);
  }, []);

  // ── Task Suggestions ────────────────────────────────────────────────────────

  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const getSuggestions = useCallback(
    async (context: string): Promise<TaskSuggestion[]> => {
      setIsSuggestionsLoading(true);
      setSuggestionsError(null);

      try {
        const result = await aiApi.suggestTasks(context);
        if (!isMountedRef.current) return [];

        setSuggestions(result);
        return result;
      } catch (err) {
        if (!isMountedRef.current) return [];

        const message = err instanceof Error ? err.message : 'Failed to get suggestions';
        setSuggestionsError(message);
        return [];
      } finally {
        if (isMountedRef.current) setIsSuggestionsLoading(false);
      }
    },
    [],
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSuggestionsError(null);
  }, []);

  // ── Blocker Analysis ────────────────────────────────────────────────────────

  const [blockerReport, setBlockerReport] = useState<BlockerReport | null>(null);
  const [isBlockerLoading, setIsBlockerLoading] = useState(false);
  const [blockerError, setBlockerError] = useState<string | null>(null);

  const analyzeBlocker = useCallback(
    async (taskId: string, description: string): Promise<BlockerReport | null> => {
      setIsBlockerLoading(true);
      setBlockerError(null);

      try {
        const report = await aiApi.analyzeBlocker(taskId, description);
        if (!isMountedRef.current) return null;

        setBlockerReport(report);
        return report;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const message = err instanceof Error ? err.message : 'Failed to analyze blocker';
        setBlockerError(message);
        return null;
      } finally {
        if (isMountedRef.current) setIsBlockerLoading(false);
      }
    },
    [],
  );

  const clearBlockerReport = useCallback(() => {
    setBlockerReport(null);
    setBlockerError(null);
  }, []);

  // ── Activity Summary ────────────────────────────────────────────────────────

  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [isActivitySummaryLoading, setIsActivitySummaryLoading] = useState(false);
  const [activitySummaryError, setActivitySummaryError] = useState<string | null>(null);

  const getActivitySummary = useCallback(
    async (
      userId: string,
      period: ActivitySummary['period'],
    ): Promise<ActivitySummary | null> => {
      setIsActivitySummaryLoading(true);
      setActivitySummaryError(null);

      try {
        const summary = await aiApi.getActivitySummary(userId, period);
        if (!isMountedRef.current) return null;

        setActivitySummary(summary);
        return summary;
      } catch (err) {
        if (!isMountedRef.current) return null;

        const message = err instanceof Error ? err.message : 'Failed to get activity summary';
        setActivitySummaryError(message);
        return null;
      } finally {
        if (isMountedRef.current) setIsActivitySummaryLoading(false);
      }
    },
    [],
  );

  return {
    messages,
    isChatLoading,
    chatError,
    sendMessage,
    clearMessages,

    suggestions,
    isSuggestionsLoading,
    suggestionsError,
    getSuggestions,
    clearSuggestions,

    blockerReport,
    isBlockerLoading,
    blockerError,
    analyzeBlocker,
    clearBlockerReport,

    activitySummary,
    isActivitySummaryLoading,
    activitySummaryError,
    getActivitySummary,
  };
}
