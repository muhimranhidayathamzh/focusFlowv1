'use strict';
const params = new URLSearchParams(location.search);
const ruleToken = params.get('rule') || '';
const attemptId = history.state?.focusflowAttemptId || crypto.randomUUID();
history.replaceState({ focusflowAttemptId: attemptId }, '');
const ui = Object.fromEntries(['summary','details','target','profile','domain','remaining','return','capture-section','capture-form','capture-text','capture-count','capture-submit','capture-status','bypass-section','start-bypass','bypass-form','reason','countdown','submit-bypass','bypass-status','open-domain'].map((id) => [id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), document.getElementById(id)]));
let context = null;
let challenge = null;
let countdownTimer = null;
let captureDraftId = `extension-distraction-${crypto.randomUUID()}`;
let captureSubmitting = false;
function remainingLabel(expectedEndAt) {
  const seconds = Math.max(0, Math.ceil((expectedEndAt - Date.now()) / 1000));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}d`;
}
async function initialize() {
  const response = await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_INTERVENTION_OPENED', ruleToken, attemptId });
  context = response?.ok ? response.context : null;
  if (!context?.active) {
    ui.summary.textContent = 'Sesi proteksi sudah tidak aktif atau konteks aturan tidak tersedia.';
    ui.return.dataset.origin = context?.focusFlowOrigin || 'http://localhost:3000';
    return;
  }
  ui.summary.textContent = 'Navigasi ini dihentikan agar kamu dapat kembali ke target yang dipilih.';
  ui.details.hidden = false;
  ui.target.textContent = context.targetLabel;
  ui.profile.textContent = context.profileName;
  ui.domain.textContent = `${context.rule.label} (${context.rule.domain})`;
  ui.remaining.textContent = remainingLabel(context.expectedEndAt);
  ui.return.dataset.origin = context.focusFlowOrigin;
  ui.captureSection.hidden = false;
  ui.bypassSection.hidden = !context.bypass.allowed;
  setInterval(() => { ui.remaining.textContent = remainingLabel(context.expectedEndAt); }, 1000);
}
ui.return.addEventListener('click', () => location.assign(ui.return.dataset.origin || 'http://localhost:3000'));
ui.captureText.addEventListener('input', () => {
  ui.captureCount.textContent = `${ui.captureText.value.length}/300`;
});
ui.captureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (captureSubmitting) return;
  const text = ui.captureText.value.trim();
  if (!text) {
    ui.captureStatus.textContent = 'Tulis sesuatu sebelum menyimpan.';
    return;
  }
  captureSubmitting = true;
  ui.captureSubmit.disabled = true;
  let response = null;
  try {
    response = await chrome.runtime.sendMessage({
      internalType: 'FOCUSFLOW_CAPTURE_ADD',
      captureId: captureDraftId,
      text,
    });
  } catch {
    response = null;
  }
  captureSubmitting = false;
  ui.captureSubmit.disabled = false;
  if (!response?.ok) {
    ui.captureStatus.textContent = response?.error || 'Capture gagal disimpan.';
    return;
  }
  ui.captureText.value = '';
  captureDraftId = `extension-distraction-${crypto.randomUUID()}`;
  ui.captureCount.textContent = '0/300';
  ui.captureStatus.textContent = 'Tersimpan. Kembali ke targetmu.';
});
ui.startBypass.addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_BYPASS_PREPARE', ruleToken, guardSessionId: context.guardSessionId });
  if (!response?.ok) { ui.bypassStatus.textContent = response?.error || 'Bypass tidak tersedia.'; return; }
  challenge = response.challenge;
  ui.bypassForm.hidden = false;
  ui.startBypass.disabled = true;
  const update = () => {
    const seconds = Math.max(0, Math.ceil((challenge.availableAt - Date.now()) / 1000));
    ui.countdown.textContent = seconds > 0 ? `Tunggu ${seconds} detik.` : 'Jeda selesai. Tuliskan alasan untuk melanjutkan.';
    ui.submitBypass.disabled = seconds > 0 || (context.bypass.requireReason && !ui.reason.value.trim());
    if (seconds === 0 && countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  };
  update();
  countdownTimer = setInterval(update, 250);
});
ui.reason.addEventListener('input', () => {
  if (challenge && Date.now() >= challenge.availableAt) ui.submitBypass.disabled = context.bypass.requireReason && !ui.reason.value.trim();
});
ui.bypassForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await chrome.runtime.sendMessage({
    internalType: 'FOCUSFLOW_BYPASS_ACTIVATE', ruleToken,
    guardSessionId: context.guardSessionId, challengeId: challenge?.challengeId,
    reason: ui.reason.value,
  });
  if (!response?.ok) { ui.bypassStatus.textContent = response?.error || 'Bypass ditolak.'; return; }
  ui.bypassStatus.textContent = `Bypass aktif sampai ${new Date(response.bypass.expiresAt).toLocaleTimeString('id-ID')}.`;
  ui.submitBypass.disabled = true;
  ui.openDomain.hidden = false;
  ui.openDomain.href = `https://${response.bypass.domain}/`;
});
void initialize().catch(() => {
  ui.summary.textContent = 'Status sesi tidak dapat dibaca. Pemblokiran dinonaktifkan secara aman.';
  ui.return.dataset.origin = 'http://localhost:3000';
});
