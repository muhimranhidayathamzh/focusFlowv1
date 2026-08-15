'use strict';
const elements = Object.fromEntries(['selected-profile','active-profile','origins','status','grant','revoke','rule-count','bypass-count','recovery','capture-context','capture-form','capture-text','capture-count','pending-captures','capture-submit','capture-status'].map((id) => [id.replace(/-([a-z])/g, (_, char) => char.toUpperCase()), document.getElementById(id)]));
let permissionStates = [];
let captureDraftId = `extension-distraction-${crypto.randomUUID()}`;
let captureSubmitting = false;

async function refresh() {
  const response = await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_POPUP_STATUS' });
  if (!response?.ok) { elements.status.textContent = 'Status extension tidak tersedia.'; return; }
  const config = response.config;
  elements.selectedProfile.textContent = config ? `${config.profile.displayName} · ${config.profile.protectionLevel}` : 'Belum ada config sync dari FocusFlow.';
  elements.activeProfile.textContent = response.activeProfile ? `Sesi aktif: ${response.activeProfile.displayName}` : 'Tidak ada sesi protected aktif.';
  permissionStates = response.permissionStates || [];
  elements.origins.replaceChildren();
  if (permissionStates.length === 0) {
    const item = document.createElement('li'); item.textContent = 'Profile tidak memerlukan host permission.'; elements.origins.append(item);
  } else {
    for (const item of permissionStates) {
      const row = document.createElement('li');
      const origin = document.createElement('code'); origin.textContent = item.origin;
      const badge = document.createElement('span'); badge.textContent = item.granted ? 'Granted' : 'Missing'; badge.className = item.granted ? 'granted' : 'missing';
      row.append(origin, badge); elements.origins.append(row);
    }
  }
  const missing = permissionStates.filter((item) => !item.granted).map((item) => item.origin);
  const granted = permissionStates.filter((item) => item.granted).map((item) => item.origin);
  elements.grant.disabled = missing.length === 0;
  elements.revoke.disabled = granted.length === 0;
  elements.status.textContent = response.status.browserGuardState === 'permission-required' ? 'Izin belum lengkap; blocking fail open.' : `Status: ${response.status.browserGuardState}`;
  elements.ruleCount.textContent = String(response.status.installedRuleCount || 0);
  elements.bypassCount.textContent = String(response.activeBypassCount || 0);
  elements.captureContext.textContent = response.capture?.sessionActive
    ? `Sesi aktif: ${response.capture.targetLabel}`
    : 'Inbox umum tersedia tanpa sesi aktif.';
  elements.pendingCaptures.textContent = String(response.capture?.pendingCount || 0);
}

elements.captureText.addEventListener('input', () => {
  elements.captureCount.textContent = `${elements.captureText.value.length}/300`;
});
elements.captureText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault();
    elements.captureForm.requestSubmit();
  }
});
elements.captureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (captureSubmitting) return;
  const text = elements.captureText.value.trim();
  if (!text) {
    elements.captureStatus.textContent = 'Tulis sesuatu sebelum menyimpan.';
    elements.captureStatus.classList.add('error');
    return;
  }
  captureSubmitting = true;
  elements.captureSubmit.disabled = true;
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
  elements.captureSubmit.disabled = false;
  if (!response?.ok) {
    elements.captureStatus.textContent = response?.error || 'Capture gagal disimpan.';
    elements.captureStatus.classList.add('error');
    return;
  }
  elements.captureText.value = '';
  captureDraftId = `extension-distraction-${crypto.randomUUID()}`;
  elements.captureCount.textContent = '0/300';
  elements.pendingCaptures.textContent = String(response.pendingCount || 0);
  elements.captureStatus.textContent = 'Tersimpan. Kembali fokus.';
  elements.captureStatus.classList.remove('error');
});

elements.grant.addEventListener('click', async () => {
  const origins = permissionStates.filter((item) => !item.granted).map((item) => item.origin);
  if (origins.length > 0) await chrome.permissions.request({ origins });
  await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_RECONCILE' });
  await refresh();
});
elements.revoke.addEventListener('click', async () => {
  const origins = permissionStates.filter((item) => item.granted).map((item) => item.origin);
  if (origins.length > 0) await chrome.permissions.remove({ origins });
  await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_RECONCILE' });
  await refresh();
});
elements.recovery.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ internalType: 'FOCUSFLOW_RECOVERY_CLEAR' });
  elements.status.textContent = 'Proteksi lokal dibersihkan. FocusFlow dapat melakukan resync.';
  await refresh();
});
void refresh();
