'use client';

import { TimerMode, timerPresets } from '@/hooks/useTimer';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useProtectedFocusSession } from '@/hooks/useProtectedFocusSession';
import { useFocusAttentionAwareness } from '@/hooks/useFocusAttentionAwareness';
import { FocusSession } from '@/types/focusSession';
import { FocusTarget } from '@/types/task';
import { Check, Play, Pause, RotateCcw, Settings2, Target, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';
import TimerSettings from './TimerSettings';
import FocusGuardStatus from '@/components/guard/FocusGuardStatus';
import FocusContract from '@/components/guard/FocusContract';
import ReturnToFocusPrompt from '@/components/guard/ReturnToFocusPrompt';
import DistractionCapture from '@/components/guard/DistractionCapture';
import { useDistractionCaptureFlow } from '@/hooks/useDistractionCaptureFlow';
import { useFocusSessionReview } from '@/hooks/useFocusSessionReview';
import SessionReview from '@/components/guard/SessionReview';
import { useFocusGuardExtensionBridge } from '@/hooks/useFocusGuardExtensionBridge';
import GuardProfileSettings from '@/components/guard/GuardProfileSettings';

export default function PomodoroTimer() {
  const [completedTarget, setCompletedTarget] = useState<FocusTarget | null>(null);
  const [isCaptureSuppressingAttention, setIsCaptureSuppressingAttention] =
    useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuardProfileSettingsOpen, setIsGuardProfileSettingsOpen] = useState(false);
  const closeGuardProfileSettings = useCallback(
    () => setIsGuardProfileSettingsOpen(false),
    []
  );
  const handleFocusSessionComplete = useCallback(
    (session: FocusSession, context: { guardSessionId?: string }) => {
      if (context.guardSessionId) {
        setCompletedTarget(null);
        return;
      }
      if (!context.guardSessionId && session.taskId && session.targetLabel) {
        setCompletedTarget({
          taskId: session.taskId,
          stepId: session.stepId,
          label: session.targetLabel,
        });
      }
    },
    []
  );

  const protectedSession = useProtectedFocusSession({
    onFocusSessionRecorded: handleFocusSessionComplete,
  });
  const extensionBridge = useFocusGuardExtensionBridge({
    isReady:
      protectedSession.attention.isHydrated &&
      protectedSession.attention.isReconciled,
    guardEnabled: protectedSession.guardEnabled,
    activeSession: protectedSession.matchingGuardSession,
    selectedProfile: protectedSession.selectedGuardProfile,
  });
  const attentionAwareness = useFocusAttentionAwareness({
    ...protectedSession.attention,
    isSuppressed: isCaptureSuppressingAttention,
  });
  const distractionCapture = useDistractionCaptureFlow({
    isEligible: protectedSession.capture.isEligible,
    guardSession: protectedSession.capture.guardSession,
    pendingIntervention: attentionAwareness.pendingIntervention,
    onOpenChange: setIsCaptureSuppressingAttention,
    onReturnCaptureComplete: attentionAwareness.dismissUnknown,
  });
  const sessionReview = useFocusSessionReview({
    isReconciled: protectedSession.attention.isReconciled,
    isBlocked:
      protectedSession.contract.isOpen ||
      distractionCapture.isOpen ||
      Boolean(attentionAwareness.pendingIntervention) ||
      isSettingsOpen ||
      isGuardProfileSettingsOpen,
  });
  const {
    timer,
    activeTarget,
    clearTarget,
    completeFocusTarget,
    guardEnabled,
    guardStatus,
    protectionMissing,
    matchingGuardSession,
    controllerError,
    isMutating,
    toggleGuardEnabled,
    handlePrimaryAction,
    resetProtectedTimer,
    switchProtectedMode,
    stopProtectedSession,
    contract,
  } = protectedSession;
  const {
    mode,
    timeLeft,
    isActive,
    sessionCount,
    settings,
    updateSettings,
    selectedPresetId,
    applyPreset,
  } = timer;

  const selectedPresetLabel = useMemo(() => {
    if (selectedPresetId === 'custom') return 'Custom timer';
    return (
      timerPresets.find((preset) => preset.id === selectedPresetId)?.label ??
      'Custom timer'
    );
  }, [selectedPresetId]);

  // Keyboard shortcuts
  const shortcutActions = useMemo(() => ({
    toggleTimer: () => void handlePrimaryAction(),
    resetTimer: () => void resetProtectedTimer(),
    switchToFocus: () => void switchProtectedMode('focus'),
    switchToShortBreak: () => void switchProtectedMode('shortBreak'),
    switchToLongBreak: () => void switchProtectedMode('longBreak'),
    toggleSettings: () => setIsSettingsOpen((prev) => !prev),
    openDistractionCapture: distractionCapture.openQuickCapture,
  }), [
    distractionCapture.openQuickCapture,
    handlePrimaryAction,
    resetProtectedTimer,
    switchProtectedMode,
  ]);

  useKeyboardShortcuts(shortcutActions, !sessionReview.isOpen);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const isCompletionTargetStillActive = Boolean(
    completedTarget &&
    activeTarget &&
    activeTarget.taskId === completedTarget.taskId &&
    activeTarget.stepId === completedTarget.stepId
  );

  const handleCompleteTarget = useCallback(() => {
    if (!completedTarget) return;

    completeFocusTarget(completedTarget);

    if (isCompletionTargetStillActive) {
      clearTarget();
    }

    setCompletedTarget(null);
  }, [
    clearTarget,
    completeFocusTarget,
    completedTarget,
    isCompletionTargetStillActive,
  ]);

  const modes: { id: TimerMode; label: string }[] = [
    { id: 'focus', label: 'Focus' },
    { id: 'shortBreak', label: 'Short Break' },
    { id: 'longBreak', label: 'Long Break' },
  ];

  return (
    <>
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-zinc-900/55 p-5 shadow-xl backdrop-blur-xl sm:p-7 lg:p-3">

        {/* Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="absolute right-4 top-4 rounded-lg border border-transparent p-2.5 text-zinc-400 transition-colors hover:border-white/10 hover:bg-zinc-800/80 hover:text-white sm:right-6 sm:top-6 lg:right-4 lg:top-4"
          aria-label="Buka pengaturan timer"
          title="Pengaturan timer"
        >
          <Settings2 size={20} />
        </button>

        <div className="mb-4 mt-1 flex items-center gap-2 rounded-full border border-white/5 bg-black/20 px-3 py-1.5 text-xs font-medium text-zinc-400 lg:mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
          <span>{selectedPresetLabel}</span>
        </div>

        {activeTarget ? (
          <div className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3.5 lg:mb-2 lg:py-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-indigo-400/10 bg-indigo-500/15">
                <Target size={15} className="text-indigo-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-300/80">
                  Fokus ke
                </p>
                <p className="truncate text-sm text-white">{activeTarget.label}</p>
              </div>
            </div>
            <button
              onClick={clearTarget}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
              title="Hapus target fokus"
              aria-label="Hapus target fokus"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="mb-4 w-full rounded-2xl border border-dashed border-white/10 bg-zinc-950/25 px-4 py-3 text-center text-sm text-zinc-400 lg:mb-2 lg:py-2 lg:text-xs">
            Pilih task sebagai target, atau mulai timer tanpa target.
          </div>
        )}

        {/* Mode Selector */}
        <div className="mb-4 flex w-full max-w-sm rounded-full border border-white/5 bg-black/40 p-1.5 backdrop-blur-md lg:mb-2 lg:p-1">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => void switchProtectedMode(m.id)}
              disabled={isMutating}
              className={cn(
                "min-h-10 flex-1 rounded-full px-2 py-2 text-xs font-medium transition-all duration-300 ease-out sm:px-4 sm:text-sm lg:min-h-9 lg:py-1.5",
                mode === m.id
                  ? "bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.16)]"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="relative mb-6 flex h-56 w-56 items-center justify-center rounded-full border-[6px] border-zinc-800/60 bg-zinc-900/60 shadow-[inset_0_4px_20px_rgba(0,0,0,0.45)] sm:h-64 sm:w-64 lg:mb-3 lg:h-52 lg:w-52 lg:border-[5px]">
          {/* Glow effect based on mode */}
          <div className={cn(
            "absolute inset-0 rounded-full blur-[40px] opacity-20 transition-colors duration-1000",
            mode === 'focus' ? "bg-red-500" : mode === 'shortBreak' ? "bg-emerald-500" : "bg-blue-500"
          )} />

          <div className="flex flex-col items-center z-10">
            <span className="text-6xl font-bold tracking-tighter text-white tabular-nums drop-shadow-md sm:text-7xl lg:text-6xl">
              {minutes}:{seconds}
            </span>
            <span className="mt-3 text-sm font-semibold tracking-wider text-zinc-400 uppercase">
              Sesi {sessionCount}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-5 flex items-center gap-4 lg:mb-3">
          <button
            onClick={() => void resetProtectedTimer()}
            aria-label="Reset timer"
            disabled={isMutating}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/5 bg-zinc-800/80 text-zinc-400 transition-all duration-300 hover:bg-zinc-700 hover:text-white active:scale-95 sm:h-14 sm:w-14 lg:h-12 lg:w-12"
            title="Reset timer"
          >
            <RotateCcw size={22} />
          </button>

          <button
            onClick={() => void handlePrimaryAction()}
            aria-label={isActive ? 'Pause timer' : 'Mulai timer'}
            disabled={isMutating}
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 active:scale-95 sm:h-20 sm:w-20 lg:h-16 lg:w-16",
              isActive
                ? "bg-zinc-800 text-white border border-white/10"
                : "bg-white text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105"
            )}
          >
            {isActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1.5" />}
          </button>
        </div>

        <FocusGuardStatus
          enabled={guardEnabled}
          status={guardStatus}
          activeSession={matchingGuardSession}
          protectionMissing={protectionMissing}
          error={controllerError ?? attentionAwareness.error}
          busy={isMutating}
          captureAvailable={protectedSession.capture.isEligible}
          captureConfirmation={distractionCapture.confirmation}
          extensionConnection={{
            state: extensionBridge.connectionState,
            version: extensionBridge.extensionVersion,
            browserProtectionState: extensionBridge.browserProtectionState,
          }}
          onCapture={distractionCapture.openQuickCapture}
          onToggle={toggleGuardEnabled}
          onStop={stopProtectedSession}
          onManageProfiles={() => setIsGuardProfileSettingsOpen(true)}
        />

        {completedTarget && (
          <div className="mt-7 w-full rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-400/10 bg-emerald-500/15">
                <Check size={15} className="text-emerald-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">
                  Sesi selesai. Target ini juga selesai?
                </p>
                <p className="mt-1 truncate text-xs text-zinc-400">
                  {completedTarget.label}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCompleteTarget}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-zinc-200"
              >
                Tandai selesai
              </button>
              <button
                onClick={() => setCompletedTarget(null)}
                className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        )}
      </div>

      <TimerSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        selectedPresetId={selectedPresetId}
        onApplyPreset={applyPreset}
        onSave={updateSettings}
      />

      {isGuardProfileSettingsOpen && (
        <GuardProfileSettings
          onClose={closeGuardProfileSettings}
        />
      )}

      <FocusContract
        isOpen={contract.isOpen}
        targetOptions={contract.targetOptions}
        profileOptions={contract.profileOptions}
        defaultTargetKey={contract.defaultTargetKey}
        defaultProfileId={contract.defaultProfileId}
        durationSeconds={contract.durationSeconds}
        presetLabel={selectedPresetLabel}
        error={contract.error}
        isSubmitting={contract.isSubmitting}
        extensionConnection={extensionBridge.connectionState}
        browserProtectionState={extensionBridge.browserProtectionState}
        onConfirm={contract.confirm}
        onCancel={contract.cancel}
      />

      <ReturnToFocusPrompt
        intervention={
          distractionCapture.isOpen || sessionReview.isOpen
            ? null
            : attentionAwareness.pendingIntervention
        }
        error={attentionAwareness.error}
        captureAvailable={
          protectedSession.capture.isEligible &&
          attentionAwareness.pendingIntervention?.guardSessionId ===
            protectedSession.capture.guardSession?.id
        }
        onCapture={distractionCapture.openFromReturnPrompt}
        onReturn={attentionAwareness.resolveReturned}
        onIntentional={attentionAwareness.resolveIntentional}
        onDismiss={attentionAwareness.dismissUnknown}
        onStop={stopProtectedSession}
      />

      <DistractionCapture
        isOpen={distractionCapture.isOpen}
        isSubmitting={distractionCapture.isSubmitting}
        targetLabel={distractionCapture.targetSnapshot?.label}
        error={distractionCapture.error}
        source={distractionCapture.source}
        onSubmit={distractionCapture.submitCapture}
        onCancel={distractionCapture.cancelCapture}
      />

      <SessionReview
        session={sessionReview.session}
        completedDurationSeconds={sessionReview.completedDurationSeconds}
        attentionSummary={sessionReview.attentionSummary}
        descriptiveSummary={sessionReview.descriptiveSummary}
        distractions={sessionReview.distractions}
        targetState={sessionReview.targetState}
        pendingReviewCount={sessionReview.pendingReviewCount}
        isSubmitting={sessionReview.isSubmitting}
        error={sessionReview.error}
        isConverting={sessionReview.isConverting}
        onSubmit={sessionReview.submitReview}
        onSkip={sessionReview.skipReview}
        onConvertDistraction={sessionReview.convertDistraction}
        onDismissDistraction={sessionReview.dismissDistraction}
      />
    </>
  );
}
