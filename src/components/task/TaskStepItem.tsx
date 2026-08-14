'use client';

import { Check, Pencil, Target, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FocusTarget, TaskStep } from '@/types/task';
import { cn } from '@/lib/utils';
import { MAX_TASK_TEXT_LENGTH } from '@/hooks/useTasks';

interface Props {
  taskId: string;
  step: TaskStep;
  isActiveTarget: boolean;
  onToggle: (taskId: string, stepId: string) => void;
  onUpdate: (taskId: string, stepId: string, text: string) => void;
  onDelete: (taskId: string, stepId: string) => void;
  onSetFocusTarget: (target: FocusTarget) => void;
}

export default function TaskStepItem({
  taskId,
  step,
  isActiveTarget,
  onToggle,
  onUpdate,
  onDelete,
  onSetFocusTarget,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(step.text);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditText(step.text);
  }, [step.text]);

  const handleSave = () => {
    const trimmed = editText.trim();

    if (trimmed && trimmed !== step.text) {
      onUpdate(taskId, step.id, trimmed);
    } else {
      setEditText(step.text);
    }

    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') handleSave();

    if (event.key === 'Escape') {
      setEditText(step.text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'group/step flex items-center gap-2 rounded-lg px-2 py-2 transition-all duration-200',
        isActiveTarget ? 'bg-indigo-500/10' : 'hover:bg-white/[0.03]',
        step.completed && 'opacity-60'
      )}
    >
      <button
        onClick={() => onToggle(taskId, step.id)}
        className={cn(
          'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all duration-200',
          step.completed
            ? 'border-emerald-500/80 bg-emerald-500/80'
            : 'border-zinc-600 hover:border-zinc-400'
        )}
        id={`task-step-toggle-${step.id}`}
        aria-label={step.completed ? `Tandai ${step.text} belum selesai` : `Tandai ${step.text} selesai`}
        title={step.completed ? 'Tandai langkah belum selesai' : 'Tandai langkah selesai'}
      >
        {step.completed && (
          <Check size={10} className="text-white" strokeWidth={3} />
        )}
      </button>

      {isEditing ? (
        <input
          ref={editRef}
          type="text"
          value={editText}
          maxLength={MAX_TASK_TEXT_LENGTH}
          onChange={(event) => setEditText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-800 px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-white/20"
        />
      ) : (
        <span
          className={cn(
            'min-w-0 flex-1 text-xs transition-all duration-200',
            step.completed ? 'text-zinc-500 line-through' : 'text-zinc-300'
          )}
          onDoubleClick={() => {
            if (!step.completed) setIsEditing(true);
          }}
        >
          {step.text}
        </span>
      )}

      {!isEditing && (
        <div className="flex items-center gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover/step:opacity-100">
          {!step.completed && (
            <>
              <button
                onClick={() =>
                  onSetFocusTarget({
                    taskId,
                    stepId: step.id,
                    label: step.text,
                  })
                }
                className={cn(
                  'rounded-md p-1.5 transition-colors',
                  isActiveTarget
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-zinc-500 hover:bg-indigo-500/10 hover:text-indigo-300'
                )}
                id={`task-step-focus-${step.id}`}
                title="Jadikan target fokus"
                aria-label={`Jadikan ${step.text} target fokus`}
              >
                <Target size={13} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
                id={`task-step-edit-${step.id}`}
                title="Edit step"
                aria-label={`Edit langkah ${step.text}`}
              >
                <Pencil size={13} />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(taskId, step.id)}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            id={`task-step-delete-${step.id}`}
            title="Hapus step"
            aria-label={`Hapus langkah ${step.text}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
