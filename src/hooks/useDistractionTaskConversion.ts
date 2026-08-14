'use client';

import { useCallback, useRef, useState } from 'react';
import { useDistractionInbox } from '@/hooks/useDistractionInbox';
import { useTasks } from '@/hooks/useTasks';
import { loadDistractionItems } from '@/lib/focusGuardPersistence';

interface WebLockManagerLike {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T>
  ): Promise<T>;
}

export type DistractionConversionResult =
  | {
      ok: true;
      taskId: string;
      alreadyApplied: boolean;
    }
  | {
      ok: false;
      reason: 'item-not-found' | 'item-resolved' | 'task-write-failed';
      partialTaskId?: string;
    };

async function withConversionLock<T>(
  distractionId: string,
  operation: () => Promise<T>
) {
  const locks = (
    navigator as Navigator & { locks?: WebLockManagerLike }
  ).locks;
  if (!locks) return operation();
  return locks.request(
    `focusflow-distraction-conversion:${distractionId}`,
    { mode: 'exclusive' },
    operation
  );
}

export function useDistractionTaskConversion() {
  const { addTaskFromDistraction } = useTasks();
  const { markConvertedToTask } = useDistractionInbox();
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());
  const convertingRef = useRef(new Set<string>());

  const convertToTask = useCallback(
    async (distractionId: string): Promise<DistractionConversionResult> => {
      if (convertingRef.current.has(distractionId)) {
        const current = loadDistractionItems().find(
          (item) => item.id === distractionId
        );
        return current?.status === 'converted-to-task' &&
          current.convertedTaskId
          ? {
              ok: true,
              taskId: current.convertedTaskId,
              alreadyApplied: true,
            }
          : { ok: false, reason: 'item-resolved' };
      }

      convertingRef.current.add(distractionId);
      setConvertingIds(new Set(convertingRef.current));
      try {
        return await withConversionLock(distractionId, async () => {
          const current = loadDistractionItems().find(
            (item) => item.id === distractionId
          );
          if (!current) return { ok: false, reason: 'item-not-found' };
          if (
            current.status === 'converted-to-task' &&
            current.convertedTaskId
          ) {
            return {
              ok: true,
              taskId: current.convertedTaskId,
              alreadyApplied: true,
            };
          }
          if (current.status !== 'inbox') {
            return { ok: false, reason: 'item-resolved' };
          }

          const task = addTaskFromDistraction(current.text, current.id);
          if (!task) return { ok: false, reason: 'task-write-failed' };

          const converted = markConvertedToTask(
            current.id,
            task.id,
            Date.now()
          );
          if (
            !converted ||
            converted.status !== 'converted-to-task' ||
            converted.convertedTaskId !== task.id
          ) {
            return {
              ok: false,
              reason: 'task-write-failed',
              partialTaskId: task.id,
            };
          }

          return {
            ok: true,
            taskId: task.id,
            alreadyApplied: false,
          };
        });
      } catch {
        return { ok: false, reason: 'task-write-failed' };
      } finally {
        convertingRef.current.delete(distractionId);
        setConvertingIds(new Set(convertingRef.current));
      }
    },
    [addTaskFromDistraction, markConvertedToTask]
  );

  return {
    convertToTask,
    isConverting: (distractionId: string) => convertingIds.has(distractionId),
  };
}
