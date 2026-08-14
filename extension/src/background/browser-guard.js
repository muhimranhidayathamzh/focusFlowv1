(function initializeFocusFlowBrowserGuard(globalScope) {
  'use strict';

  const WEBSITE_RULE_MIN = 100000;
  const WEBSITE_RULE_MAX = 199999;
  const BYPASS_RULE_MIN = 200000;
  const BYPASS_RULE_MAX = 299999;
  const BYPASS_PRIORITY = 10000000;
  const PROTECTED_FOCUSFLOW_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'focusflow-fawn-ten.vercel.app',
  ]);

  function normalizeDomain(value) {
    if (typeof value !== 'string') return null;
    let domain = value.trim().toLowerCase();
    while (domain.endsWith('.')) domain = domain.slice(0, -1);
    if (!domain || domain.length > 253 || domain.includes('/') || domain.includes(':') || PROTECTED_FOCUSFLOW_HOSTS.has(domain)) return null;
    const labels = domain.split('.');
    if (labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    return domain;
  }

  function hostnameMatchesDomain(hostname, domain) {
    const host = normalizeDomain(hostname);
    const target = normalizeDomain(domain);
    return Boolean(host && target && (host === target || host.endsWith(`.${target}`)));
  }

  function normalizePrefix(value) {
    try {
      if (typeof value !== 'string' || value.includes('#')) return null;
      const url = new URL(value.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
      const domain = normalizeDomain(url.hostname);
      if (!domain) return null;
      url.hostname = domain;
      return { normalized: url.href, domain, scheme: url.protocol.slice(0, -1) };
    } catch { return null; }
  }

  function normalizePattern(value) {
    if (typeof value !== 'string') return null;
    const input = value.trim().toLowerCase();
    if (input.length > 2048 || /[\s#\\\[\](){}|^$+]/.test(input)) return null;
    const match = /^(https?|\*):\/\/((?:\*\.)?[^/]+)(\/.*)$/.exec(input);
    if (!match || match[3].includes('**') || match[3].includes('?')) return null;
    const includeSubdomains = match[2].startsWith('*.');
    const domain = normalizeDomain(includeSubdomains ? match[2].slice(2) : match[2]);
    if (!domain) return null;
    return {
      normalized: `${match[1]}://${includeSubdomains ? '*.' : ''}${domain}${match[3]}`,
      scheme: match[1], domain, includeSubdomains, path: match[3],
    };
  }

  function normalizeRule(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = typeof value.id === 'string' ? value.id.trim().slice(0, 160) : '';
    const label = typeof value.label === 'string' ? value.label.trim().replace(/\s+/g, ' ').slice(0, 160) : '';
    if (!id || !['block', 'allow'].includes(value.action) || !['domain', 'url-prefix', 'url-pattern'].includes(value.matchType)) return null;
    let normalized;
    let domain;
    if (value.matchType === 'domain') {
      normalized = normalizeDomain(value.pattern);
      domain = normalized;
    } else if (value.matchType === 'url-prefix') {
      const prefix = normalizePrefix(value.pattern);
      normalized = prefix?.normalized;
      domain = prefix?.domain;
    } else {
      const pattern = normalizePattern(value.pattern);
      normalized = pattern?.normalized;
      domain = pattern?.domain;
    }
    if (!normalized || !domain) return null;
    return { id, label: label || domain, action: value.action, matchType: value.matchType, pattern: normalized, domain };
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function deterministicRuleId(ruleId, rangeStart, rangeEnd) {
    return rangeStart + (stableHash(ruleId) % (rangeEnd - rangeStart + 1));
  }
  function safeRuleToken(ruleId) { return `r-${stableHash(ruleId).toString(36)}`; }

  function originsForRule(rule) {
    if (rule.matchType === 'domain') return [`http://${rule.domain}/*`, `http://*.${rule.domain}/*`, `https://${rule.domain}/*`, `https://*.${rule.domain}/*`];
    if (rule.matchType === 'url-prefix') {
      const url = new URL(rule.pattern);
      return [`${url.protocol}//${rule.domain}/*`];
    }
    const pattern = normalizePattern(rule.pattern);
    const origins = [];
    const schemes = pattern.scheme === '*' ? ['http', 'https'] : [pattern.scheme];
    for (const scheme of schemes) {
      origins.push(`${scheme}://${pattern.domain}/*`);
      if (pattern.includeSubdomains) origins.push(`${scheme}://*.${pattern.domain}/*`);
    }
    return origins;
  }

  function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function patternRegex(pattern) {
    const scheme = pattern.scheme === '*' ? 'https?' : pattern.scheme;
    const host = pattern.includeSubdomains
      ? `(?:[^./]+\\.)*${escapeRegex(pattern.domain)}`
      : escapeRegex(pattern.domain);
    const path = pattern.path.split('*').map(escapeRegex).join('.*');
    return `^${scheme}://${host}${path}$`;
  }

  function conditionForRule(rule) {
    if (rule.matchType === 'domain') return { requestDomains: [rule.domain], resourceTypes: ['main_frame'] };
    if (rule.matchType === 'url-prefix') return { urlFilter: `|${rule.pattern}`, resourceTypes: ['main_frame'] };
    return { regexFilter: patternRegex(normalizePattern(rule.pattern)), resourceTypes: ['main_frame'] };
  }

  function specificity(rule) {
    const literal = rule.pattern.replace(/\*/g, '').length;
    return (rule.matchType === 'url-prefix' ? 3000 : rule.matchType === 'url-pattern' ? 2000 : 1000) + Math.min(literal, 900);
  }

  function priorityForRule(rule, index) {
    return specificity(rule) * 1000 + (rule.action === 'allow' ? 100 : 0) + Math.min(index, 99);
  }

  function compileRuleSet(snapshot) {
    if (!snapshot || snapshot.status !== 'active' || snapshot.protectionLevel === 'light') return { ok: true, contexts: [], requiredOrigins: [] };
    if (!Array.isArray(snapshot.websiteRules) || snapshot.websiteRules.length > 100) return { ok: false, contexts: [], requiredOrigins: [], error: 'INVALID_RULE_SET' };
    const contexts = [];
    const ids = new Set();
    const equivalents = new Set();
    const usedWebsiteIds = new Set();
    const usedBypassIds = new Set();
    const origins = new Set();
    for (let index = 0; index < snapshot.websiteRules.length; index += 1) {
      const rule = normalizeRule(snapshot.websiteRules[index]);
      if (!rule) return { ok: false, contexts: [], requiredOrigins: [], error: 'INVALID_RULE' };
      const equivalent = `${rule.matchType}:${rule.pattern}`;
      if (ids.has(rule.id) || equivalents.has(equivalent)) return { ok: false, contexts: [], requiredOrigins: [], error: 'DUPLICATE_RULE' };
      ids.add(rule.id); equivalents.add(equivalent);
      let dnrRuleId = deterministicRuleId(rule.id, WEBSITE_RULE_MIN, WEBSITE_RULE_MAX);
      while (usedWebsiteIds.has(dnrRuleId)) dnrRuleId = dnrRuleId === WEBSITE_RULE_MAX ? WEBSITE_RULE_MIN : dnrRuleId + 1;
      usedWebsiteIds.add(dnrRuleId);
      let bypassRuleId = deterministicRuleId(rule.id, BYPASS_RULE_MIN, BYPASS_RULE_MAX);
      while (usedBypassIds.has(bypassRuleId)) bypassRuleId = bypassRuleId === BYPASS_RULE_MAX ? BYPASS_RULE_MIN : bypassRuleId + 1;
      usedBypassIds.add(bypassRuleId);
      const ruleOrigins = originsForRule(rule);
      ruleOrigins.forEach((origin) => origins.add(origin));
      contexts.push({
        token: safeRuleToken(rule.id), configuredRuleId: rule.id,
        label: rule.label, domain: rule.domain, action: rule.action,
        matchType: rule.matchType, pattern: rule.pattern,
        dnrRuleId, blockRuleId: dnrRuleId, bypassRuleId,
        priority: priorityForRule(rule, index), condition: conditionForRule(rule),
        requiredOrigins: ruleOrigins,
      });
    }
    return { ok: true, contexts, requiredOrigins: [...origins].sort() };
  }

  function compileRuleContexts(snapshot) {
    const result = compileRuleSet(snapshot);
    return result.ok ? result.contexts : [];
  }

  function createSessionRule(context, redirectUrl) {
    return {
      id: context.dnrRuleId, priority: context.priority,
      action: context.action === 'allow'
        ? { type: 'allow' }
        : { type: 'redirect', redirect: { url: redirectUrl } },
      condition: context.condition,
    };
  }
  function createBlockRule(context, redirectUrl) { return createSessionRule(context, redirectUrl); }
  function createBypassRule(context) {
    return { id: context.bypassRuleId, priority: BYPASS_PRIORITY, action: { type: 'allow' }, condition: context.condition };
  }
  function optionalOrigins(domain) { return [`http://${domain}/*`, `http://*.${domain}/*`, `https://${domain}/*`, `https://*.${domain}/*`]; }
  function isFocusFlowRuleId(id) { return (id >= WEBSITE_RULE_MIN && id <= WEBSITE_RULE_MAX) || (id >= BYPASS_RULE_MIN && id <= BYPASS_RULE_MAX); }

  function urlMatchesRule(ruleValue, rawUrl) {
    const rule = normalizeRule(ruleValue);
    if (!rule) return false;
    try {
      const url = new URL(rawUrl);
      if (rule.matchType === 'domain') return url.hostname === rule.domain || url.hostname.endsWith(`.${rule.domain}`);
      if (rule.matchType === 'url-prefix') return url.href.startsWith(rule.pattern);
      return new RegExp(patternRegex(normalizePattern(rule.pattern)), 'i').test(url.href);
    } catch { return false; }
  }

  globalScope.FocusFlowBrowserGuard = Object.freeze({
    WEBSITE_RULE_MIN, WEBSITE_RULE_MAX, BLOCK_RULE_MIN: WEBSITE_RULE_MIN,
    BLOCK_RULE_MAX: WEBSITE_RULE_MAX, BYPASS_RULE_MIN, BYPASS_RULE_MAX,
    BLOCK_PRIORITY: 1000000, BYPASS_PRIORITY, normalizeDomain,
    hostnameMatchesDomain, normalizePrefix, normalizePattern, normalizeRule,
    deterministicRuleId, safeRuleToken, compileRuleSet, compileRuleContexts,
    originsForRule, optionalOrigins, priorityForRule, createSessionRule,
    createBlockRule, createBypassRule, isFocusFlowRuleId, urlMatchesRule,
  });
})(globalThis);
