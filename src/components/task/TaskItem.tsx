'use client';

import {
  Check,
  ChevronDown,
  ListChecks,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { FocusTarget, Task } from '@/types/task';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import TaskStepItem from './TaskStepItem';
import { MAX_TASK_STEPS, MAX_TASK_TEXT_LENGTH } from '@/hooks/useTasks';

interface Props {
  task: Task;
  activeTarget: FocusTarget | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  onAddStep: (taskId: string, text: string) => void;
  onToggleStep: (taskId: string, stepId: string) => void;
  onUpdateStep: (taskId: string, stepId: string, text: string) => void;
  onDeleteStep: (taskId: string, stepId: string) => void;
  onSetFocusTarget: (target: FocusTarget) => void;
}

export default function TaskItem({
  task,
  activeTarget,
  onToggle,
  onDelete,
  onUpdate,
  onAddStep,
  onToggleStep,
  onUpdateStep,
  onDeleteStep,
  onSetFocusTarget,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState((task.steps ?? []).length > 0);
  const [newStepText, setNewStepText] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const steps = task.steps ?? [];
  const completedSteps = steps.filter((step) => step.completed).length;
  const isTaskTarget =
    activeTarget?.taskId === task.id && activeTarget.stepId === undefined;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditText(task.text);
  }, [task.text]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) {
      onUpdate(task.id, trimmed);
    } else {
      setEditText(task.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditText(task.text);
      setIsEditing(false);
    }
  };

  const handleAddStep = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = newStepText.trim();
    if (!trimmed) return;

    onAddStep(task.id, trimmed);
    setNewStepText('');
    setIsExpanded(true);
  };

  return (
    <div
      className={cn(
        'rounded-xl transition-all duration-300',
        isTaskTarget ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]',
        task.completed && 'opacity-70'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="group flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => onToggle(task.id)}
          className={cn(
            'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all duration-300',
            task.completed
              ? 'border-emerald-500/80 bg-emerald-500/80'
              : 'border-zinc-600 hover:border-zinc-400'
          )}
          id={`task-toggle-${task.id}`}
          aria-label={task.completed ? `Tandai ${task.text} belum selesai` : `Tandai ${task.text} selesai`}
          title={task.completed ? 'Tandai belum selesai' : 'Tandai selesai'}
        >
          {task.completed && (
            <Check size={12} className="text-white" strokeWidth={3} />
          )}
        </button>

        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              ref={editRef}
              type="text"
              value={editText}
              maxLength={MAX_TASK_TEXT_LENGTH}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              className="flex-1 rounded-lg border border-white/10 bg-zinc-800 px-3 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        ) : (
          <div
            className="min-w-0 flex-1 cursor-default"
            onDoubleClick={() => {
              if (!task.completed) {
                setIsEditing(true);
              }
            }}
          >
            <span
              className={cn(
                'block truncate text-sm transition-all duration-300',
                task.completed ? 'text-zinc-400 line-through' : 'text-zinc-200'
              )}
            >
              {task.text}
            </span>
            {steps.length > 0 && (
              <span className="mt-1 block text-[11px] text-zinc-600">
                {completedSteps}/{steps.length} langkah
              </span>
            )}
          </div>
        )}

        {!isEditing && (
          <div
            className={cn(
              'flex items-center gap-1 transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'opacity-100 sm:opacity-0'
            )}
          >
            {!task.completed && steps.length < MAX_TASK_STEPS && (
              <>
                <button
                  onClick={() =>
                    onSetFocusTarget({
                      taskId: task.id,
                      label: task.text,
                    })
                  }
                  className={cn(
                    'rounded-md p-1.5 transition-colors',
                    isTaskTarget
                      ? 'bg-indigo-500/15 text-indigo-300'
                      : 'text-zinc-500 hover:bg-indigo-500/10 hover:text-indigo-300'
                  )}
                  id={`task-focus-${task.id}`}
                  title="Jadikan target fokus"
                  aria-label={`Jadikan ${task.text} target fokus`}
                >
                  <Target size={14} />
                </button>
                <button
                  onClick={() => {
                    setIsExpanded((current) => !current);
                  }}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
                  id={`task-steps-${task.id}`}
                  title="Checklist langkah kecil"
                  aria-label={`${isExpanded ? 'Tutup' : 'Buka'} checklist ${task.text}`}
                  aria-expanded={isExpanded}
                >
                  {steps.length > 0 ? (
                    <ChevronDown
                      size={14}
                      className={cn(
                        'transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  ) : (
                    <ListChecks size={14} />
                  )}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
                  id={`task-edit-${task.id}`}
                  title="Edit task"
                  aria-label={`Edit ${task.text}`}
                >
                  <Pencil size={14} />
                </button>
              </>
            )}
            <button
              onClick={() => onDelete(task.id)}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              id={`task-delete-${task.id}`}
              title="Hapus task"
              aria-label={`Hapus ${task.text}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="pb-3 pl-10 pr-3">
          <div className="space-y-1 border-l border-white/5 pl-3">
            {steps.map((step) => (
              <TaskStepItem
                key={step.id}
                taskId={task.id}
                step={step}
                isActiveTarget={
                  activeTarget?.taskId === task.id &&
                  activeTarget.stepId === step.id
                }
                onToggle={onToggleStep}
                onUpdate={onUpdateStep}
                onDelete={onDeleteStep}
                onSetFocusTarget={onSetFocusTarget}
              />
            ))}

            {!task.completed && (
              <form onSubmit={handleAddStep} className="flex items-center gap-2 pt-1">
                <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-dashed border-zinc-700">
                  <Plus size={10} className="text-zinc-600" />
                </div>
                <input
                  type="text"
                  value={newStepText}
                  maxLength={MAX_TASK_TEXT_LENGTH}
                  onChange={(event) => setNewStepText(event.target.value)}
                  placeholder="Langkah kecil berikutnya..."
                  className="min-w-0 flex-1 rounded-lg border border-white/5 bg-zinc-950/40 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-white/10 focus:ring-1 focus:ring-white/10"
                  id={`task-step-input-${task.id}`}
                />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
