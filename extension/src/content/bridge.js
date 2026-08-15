(function initializeFocusFlowContentBridge() {
  'use strict';

  const protocol = globalThis.FocusFlowBridgeProtocol;
  if (!protocol) return;

  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://focusflow-fawn-ten.vercel.app',
  ]);
  const pageOrigin = window.location.origin;
  if (!allowedOrigins.has(pageOrigin)) return;
  const pageRequestTypes = new Set([
    protocol.MESSAGE_TYPES.PING,
    protocol.MESSAGE_TYPES.SESSION_SYNC,
    protocol.MESSAGE_TYPES.SESSION_CLEAR,
    protocol.MESSAGE_TYPES.STATUS_REQUEST,
    protocol.MESSAGE_TYPES.EVENT_DRAIN,
    protocol.MESSAGE_TYPES.EVENT_ACK,
    protocol.MESSAGE_TYPES.CONFIG_SYNC,
    protocol.MESSAGE_TYPES.CAPTURE_DRAIN,
    protocol.MESSAGE_TYPES.CAPTURE_ACK,
  ]);

  function createRequestId(prefix) {
    const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    return `${prefix}-${suffix}`.slice(0, 128);
  }

  function postToPage(envelope) {
    window.postMessage(envelope, pageOrigin);
  }

  function postError(requestId, code, message) {
    postToPage(
      protocol.createErrorEnvelope(
        requestId || createRequestId('content-error'),
        code,
        message
      )
    );
  }

  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      event.origin !== pageOrigin ||
      !event.data ||
      event.data.channel !== protocol.CHANNEL
    ) {
      return;
    }

    // window.postMessage is delivered to every listener in this page,
    // including this content script. Ignore extension responses that the
    // bridge itself posts back to the page; otherwise each response becomes
    // an UNKNOWN_MESSAGE error that recursively produces another error.
    if (!pageRequestTypes.has(event.data.type)) return;

    const checked = protocol.validatePageRequestEnvelope(event.data, Date.now());
    if (!checked.ok) {
      postError(checked.requestId, checked.code, checked.message);
      return;
    }

    try {
      chrome.runtime.sendMessage(checked.envelope, (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          postError(
            checked.envelope.requestId,
            'RUNTIME_UNAVAILABLE',
            'Extension service worker is unavailable.'
          );
          return;
        }
        const validated = protocol.validateExtensionResponseEnvelope(response);
        if (!validated.ok) {
          postError(
            checked.envelope.requestId,
            'MALFORMED_RESPONSE',
            'Extension response was rejected by the content bridge.'
          );
          return;
        }
        postToPage(validated.envelope);
      });
    } catch {
      postError(
        checked.envelope.requestId,
        'RUNTIME_UNAVAILABLE',
        'Extension runtime is unavailable.'
      );
    }
  });

  postToPage(
    protocol.createEnvelope(
      protocol.MESSAGE_TYPES.READY,
      createRequestId('ready'),
      {
        extensionVersion: protocol.EXTENSION_VERSION,
        protocolVersion: protocol.PROTOCOL_VERSION,
        snapshotSchemaVersion: protocol.SNAPSHOT_SCHEMA_VERSION,
      }
    )
  );
})();
