import { useState, useEffect, useCallback } from 'react';
import { FocusTarget, Task, TaskStep } from '@/types/task';

const STORAGE_KEY = 'focusflow-tasks';
const TASKS_UPDATED_EVENT = 'focusflow-tasks-updated';
export const MAX_TASK_RECORDS = 500;
export const MAX_TASK_STEPS = 100;
export const MAX_TASK_TEXT_LENGTH = 300;
export const MAX_TASK_STORAGE_CHARS = 1_000_000;

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStep(value: unknown): TaskStep | null {
  if (!value || typeof value !== 'object') return null;

  const step = value as Partial<TaskStep>;
  if (
    typeof step.id !== 'string' ||
    typeof step.text !== 'string' ||
    typeof step.completed !== 'boolean' ||
    typeof step.createdAt !== 'number'
  ) {
    return null;
  }

  return {
    id: step.id,
    text: step.text.trim().slice(0, MAX_TASK_TEXT_LENGTH),
    completed: step.completed,
    createdAt: step.createdAt,
    completedAt:
      typeof step.completedAt === 'number' ? step.completedAt : undefined,
  };
}

function normalizeTask(value: unknown): Task | null {
  if (!value || typeof value !== 'object') return null;

  const task = value as Partial<Task>;
  if (
    typeof task.id !== 'string' ||
    typeof task.text !== 'string' ||
    typeof task.completed !== 'boolean' ||
    typeof task.createdAt !== 'number'
  ) {
    return null;
  }

  return {
    id: task.id,
    text: task.text.trim().slice(0, MAX_TASK_TEXT_LENGTH),
    sourceDistractionId:
      typeof task.sourceDistractionId === 'string' &&
      task.sourceDistractionId.trim()
        ? task.sourceDistractionId.trim().slice(0, 160)
        : undefined,
    completed: task.completed,
    createdAt: task.createdAt,
    completedAt:
      typeof task.completedAt === 'number' ? task.completedAt : undefined,
    steps: Array.isArray(task.steps)
      ? task.steps
          .map(normalizeStep)
          .filter((step): step is TaskStep => !!step)
          .slice(0, MAX_TASK_STEPS)
      : [],
  };
}

function loadTasks(): Task[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeTask)
          .filter((task): task is Task => !!task)
          .slice(0, MAX_TASK_RECORDS)
      : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(tasks.slice(0, MAX_TASK_RECORDS));
    if (serialized.length > MAX_TASK_STORAGE_CHARS) return false;
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function notifyTasksUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TASKS_UPDATED_EVENT));
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTasks(loadTasks());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reloadTasks = () => {
      setTasks(loadTasks());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        reloadTasks();
      }
    };

    window.addEventListener(TASKS_UPDATED_EVENT, reloadTasks);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(TASKS_UPDATED_EVENT, reloadTasks);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateStoredTasks = useCallback((updater: (current: Task[]) => Task[]) => {
    const nextTasks = updater(loadTasks()).slice(0, MAX_TASK_RECORDS);
    if (!saveTasks(nextTasks)) return null;
    setTasks(nextTasks);
    notifyTasksUpdated();
    return nextTasks;
  }, []);

  const addTask = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, MAX_TASK_TEXT_LENGTH);
    if (!trimmed) return;

    const newTask: Task = {
      id: createId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
      steps: [],
    };

    return updateStoredTasks((prev) => [newTask, ...prev]) ? newTask : null;
  }, [updateStoredTasks]);

  const addTaskFromDistraction = useCallback(
    (text: string, distractionId: string) => {
      const trimmed = text.trim().slice(0, MAX_TASK_TEXT_LENGTH);
      const sourceDistractionId = distractionId.trim().slice(0, 160);
      if (!trimmed || !sourceDistractionId) return null;

      const deterministicTaskId = `task-from-${sourceDistractionId}`;
      const saved = updateStoredTasks((prev) => {
        const existing = prev.find(
          (task) =>
            task.sourceDistractionId === sourceDistractionId ||
            task.id === deterministicTaskId
        );
        if (existing) {
          return prev;
        }

        const newTask: Task = {
          id: deterministicTaskId,
          text: trimmed,
          sourceDistractionId,
          completed: false,
          createdAt: Date.now(),
          steps: [],
        };
        return [newTask, ...prev];
      });

      if (!saved) return null;
      return (
        loadTasks().find(
          (task) =>
            task.sourceDistractionId === sourceDistractionId ||
            task.id === deterministicTaskId
        ) ?? null
      );
    },
    [updateStoredTasks]
  );

  const toggleTask = useCallback((id: string) => {
    updateStoredTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        const completed = !t.completed;
        return {
          ...t,
          completed,
          completedAt: completed ? Date.now() : undefined,
        };
      })
    );
  }, [updateStoredTasks]);

  const updateTask = useCallback((id: string, text: string) => {
    const trimmed = text.trim().slice(0, MAX_TASK_TEXT_LENGTH);
    if (!trimmed) return;

    updateStoredTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: trimmed } : t))
    );
  }, [updateStoredTasks]);

  const deleteTask = useCallback((id: string) => {
    updateStoredTasks((prev) => prev.filter((t) => t.id !== id));
  }, [updateStoredTasks]);

  const addStep = useCallback((taskId: string, text: string) => {
    const trimmed = text.trim().slice(0, MAX_TASK_TEXT_LENGTH);
    if (!trimmed) return;

    const newStep: TaskStep = {
      id: createId(),
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    updateStoredTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: [...(task.steps ?? []), newStep].slice(0, MAX_TASK_STEPS),
            }
          : task
      )
    );
  }, [updateStoredTasks]);

  const toggleStep = useCallback((taskId: string, stepId: string) => {
    updateStoredTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        return {
          ...task,
          steps: (task.steps ?? []).map((step) => {
            if (step.id !== stepId) return step;

            const completed = !step.completed;
            return {
              ...step,
              completed,
              completedAt: completed ? Date.now() : undefined,
            };
          }),
        };
      })
    );
  }, [updateStoredTasks]);

  const updateStep = useCallback(
    (taskId: string, stepId: string, text: string) => {
      const trimmed = text.trim().slice(0, MAX_TASK_TEXT_LENGTH);
      if (!trimmed) return;

      updateStoredTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                steps: (task.steps ?? []).map((step) =>
                  step.id === stepId ? { ...step, text: trimmed } : step
                ),
              }
            : task
        )
      );
    },
    [updateStoredTasks]
  );

  const deleteStep = useCallback((taskId: string, stepId: string) => {
    updateStoredTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: (task.steps ?? []).filter((step) => step.id !== stepId),
            }
          : task
      )
    );
  }, [updateStoredTasks]);

  const completeFocusTarget = useCallback(
    (target: FocusTarget) => {
      let completedTarget = false;
      const completedAt = Date.now();

      const saved = updateStoredTasks((prev) =>
        prev.map((task) => {
          if (task.id !== target.taskId) return task;

          if (!target.stepId) {
            if (task.completed) return task;

            completedTarget = true;
            return {
              ...task,
              completed: true,
              completedAt,
            };
          }

          return {
            ...task,
            steps: (task.steps ?? []).map((step) => {
              if (step.id !== target.stepId || step.completed) return step;

              completedTarget = true;
              return {
                ...step,
                completed: true,
                completedAt,
              };
            }),
          };
        })
      );

      return Boolean(saved && completedTarget);
    },
    [updateStoredTasks]
  );

  const completedCount = tasks.filter((t) => t.completed).length;

  return {
    tasks,
    isLoaded,
    addTask,
    addTaskFromDistraction,
    toggleTask,
    updateTask,
    deleteTask,
    addStep,
    toggleStep,
    updateStep,
    deleteStep,
    completeFocusTarget,
    completedCount,
    totalCount: tasks.length,
  };
}
