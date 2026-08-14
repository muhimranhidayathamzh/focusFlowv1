'use client';

import { useCallback, useEffect } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useFocusTarget } from '@/hooks/useFocusTarget';
import { ClipboardList, Target, X } from 'lucide-react';
import { FocusTarget } from '@/types/task';
import TaskInput from './TaskInput';
import TaskItem from './TaskItem';

export default function TaskList() {
  const {
    tasks,
    isLoaded,
    addTask,
    toggleTask,
    updateTask,
    deleteTask,
    addStep,
    toggleStep,
    updateStep,
    deleteStep,
    completedCount,
    totalCount,
  } = useTasks();
  const { activeTarget, setTarget, clearTarget } = useFocusTarget();

  useEffect(() => {
    if (!isLoaded || !activeTarget) return;

    const task = tasks.find((item) => item.id === activeTarget.taskId);

    if (!task) {
      clearTarget();
      return;
    }

    if (
      activeTarget.stepId &&
      !(task.steps ?? []).some((step) => step.id === activeTarget.stepId)
    ) {
      clearTarget();
    }
  }, [activeTarget, clearTarget, isLoaded, tasks]);

  const handleSetFocusTarget = useCallback(
    (target: FocusTarget) => {
      setTarget(target);
    },
    [setTarget]
  );

  const handleToggleTask = useCallback(
    (id: string) => {
      const task = tasks.find((item) => item.id === id);

      if (!task?.completed && activeTarget?.taskId === id) {
        clearTarget();
      }

      toggleTask(id);
    },
    [activeTarget, clearTarget, tasks, toggleTask]
  );

  const handleUpdateTask = useCallback(
    (id: string, text: string) => {
      updateTask(id, text);

      if (activeTarget?.taskId === id && !activeTarget.stepId) {
        setTarget({
          taskId: id,
          label: text,
        });
      }
    },
    [activeTarget, setTarget, updateTask]
  );

  const handleDeleteTask = useCallback(
    (id: string) => {
      if (activeTarget?.taskId === id) {
        clearTarget();
      }

      deleteTask(id);
    },
    [activeTarget, clearTarget, deleteTask]
  );

  const handleToggleStep = useCallback(
    (taskId: string, stepId: string) => {
      const task = tasks.find((item) => item.id === taskId);
      const step = task?.steps?.find((item) => item.id === stepId);

      if (
        step &&
        !step.completed &&
        activeTarget?.taskId === taskId &&
        activeTarget.stepId === stepId
      ) {
        clearTarget();
      }

      toggleStep(taskId, stepId);
    },
    [activeTarget, clearTarget, tasks, toggleStep]
  );

  const handleUpdateStep = useCallback(
    (taskId: string, stepId: string, text: string) => {
      updateStep(taskId, stepId, text);

      if (
        activeTarget?.taskId === taskId &&
        activeTarget.stepId === stepId
      ) {
        setTarget({
          taskId,
          stepId,
          label: text,
        });
      }
    },
    [activeTarget, setTarget, updateStep]
  );

  const handleDeleteStep = useCallback(
    (taskId: string, stepId: string) => {
      if (
        activeTarget?.taskId === taskId &&
        activeTarget.stepId === stepId
      ) {
        clearTarget();
      }

      deleteStep(taskId, stepId);
    },
    [activeTarget, clearTarget, deleteStep]
  );

  // Don't render until localStorage is loaded (avoid hydration flash)
  if (!isLoaded) {
    return (
      <div className="mx-auto w-full animate-pulse rounded-3xl border border-white/[0.07] bg-zinc-900/45 p-5 sm:p-6">
        <div className="h-6 w-40 bg-zinc-800 rounded-lg mb-6" />
        <div className="space-y-3">
          <div className="h-12 bg-zinc-800/50 rounded-2xl" />
          <div className="h-10 bg-zinc-800/30 rounded-xl" />
          <div className="h-10 bg-zinc-800/30 rounded-xl" />
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <section className="mx-auto w-full rounded-3xl border border-white/[0.07] bg-zinc-900/45 p-5 shadow-xl backdrop-blur-xl sm:p-6" aria-labelledby="today-tasks-heading">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/5">
            <ClipboardList size={16} className="text-zinc-400" />
          </div>
          <h2 id="today-tasks-heading" className="text-lg font-semibold text-white">Task Hari Ini</h2>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-400">
              {completedCount}/{totalCount}
            </span>
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500/80 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mb-4">
        <TaskInput onAdd={addTask} />
      </div>

      {activeTarget && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-indigo-400/15 bg-indigo-500/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-400/10 bg-indigo-500/15">
              <Target size={15} className="text-indigo-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-300/80">
                Target aktif
              </p>
              <p className="truncate text-sm text-white">{activeTarget.label}</p>
            </div>
          </div>
          <button
            onClick={clearTarget}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
            title="Hapus target aktif"
            aria-label="Hapus target aktif"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-0.5">
        {/* Empty State */}
        {totalCount === 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 px-4 py-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-800/50">
              <ClipboardList size={18} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-sm text-zinc-300">Belum ada tugas</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                Tulis satu tujuan, lalu pecah menjadi langkah kecil bila perlu.
              </p>
            </div>
          </div>
        )}

        {/* Active Tasks */}
        {activeTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            activeTarget={activeTarget}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onUpdate={handleUpdateTask}
            onAddStep={addStep}
            onToggleStep={handleToggleStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onSetFocusTarget={handleSetFocusTarget}
          />
        ))}

        {/* Completed Tasks */}
        {completedTasks.length > 0 && activeTasks.length > 0 && (
          <div className="pt-3 mt-3 border-t border-white/5">
            <p className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider px-4 mb-1">
              Selesai
            </p>
          </div>
        )}
        {completedTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            activeTarget={activeTarget}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onUpdate={handleUpdateTask}
            onAddStep={addStep}
            onToggleStep={handleToggleStep}
            onUpdateStep={handleUpdateStep}
            onDeleteStep={handleDeleteStep}
            onSetFocusTarget={handleSetFocusTarget}
          />
        ))}
      </div>
    </section>
  );
}
