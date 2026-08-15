'use strict';

const ui = Object.fromEntries(
  [
    'session-status',
    'capture-form',
    'capture-text',
    'capture-submit',
    'capture-status',
    'character-count',
    'pending-count',
    'shortcut',
  ].map((id) => [
    id.replace(/-([a-z])/g, (_, character) => character.toUpperCase()),
    document.getElementById(id),
  ])
);
let draftId = `extension-distraction-${crypto.randomUUID()}`;
let isSubmitting = false;

function updateCharacterCount() {
  ui.characterCount.textContent = `${ui.captureText.value.length}/300`;
}

async function refreshStatus() {
  const response = await chrome.runtime.sendMessage({
    internalType: 'FOCUSFLOW_CAPTURE_STATUS',
  });
  if (!response?.ok) {
    ui.sessionStatus.textContent = 'Status FocusFlow tidak tersedia.';
    return;
  }
  ui.sessionStatus.textContent = response.sessionActive
    ? `Sesi aktif: ${response.targetLabel}`
    : 'Tidak ada sesi protected aktif. Item akan masuk ke Inbox umum.';
  ui.pendingCount.textContent = String(response.pendingCount || 0);
  if (response.shortcut) ui.shortcut.textContent = response.shortcut;
}

ui.captureText.addEventListener('input', updateCharacterCount);
ui.captureText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    ui.captureForm.requestSubmit();
  }
});

ui.captureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isSubmitting) return;
  const text = ui.captureText.value.trim();
  if (!text) {
    ui.captureStatus.textContent = 'Tulis sesuatu sebelum menyimpan.';
    ui.captureStatus.classList.add('error');
    return;
  }
  isSubmitting = true;
  ui.captureSubmit.disabled = true;
  ui.captureStatus.textContent = 'Menyimpan…';
  ui.captureStatus.classList.remove('error');
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({
      internalType: 'FOCUSFLOW_CAPTURE_ADD',
      captureId: draftId,
      text,
    });
  } catch {
    response = null;
  }
  isSubmitting = false;
  ui.captureSubmit.disabled = false;
  if (!response?.ok) {
    ui.captureStatus.textContent = response?.error || 'Capture gagal disimpan.';
    ui.captureStatus.classList.add('error');
    return;
  }
  ui.captureText.value = '';
  draftId = `extension-distraction-${crypto.randomUUID()}`;
  updateCharacterCount();
  ui.pendingCount.textContent = String(response.pendingCount || 0);
  ui.captureStatus.textContent = 'Tersimpan. Kamu bisa kembali fokus.';
  ui.captureText.focus();
});

void refreshStatus().catch(() => {
  ui.sessionStatus.textContent = 'Status FocusFlow tidak tersedia.';
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === 'local' &&
    changes['focusflow-distraction-capture-queue-v1']
  ) {
    void refreshStatus().catch(() => undefined);
  }
});
