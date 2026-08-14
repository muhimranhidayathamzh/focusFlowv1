import type { GuardRuleAction, WebsiteRule } from '@/types/focusGuard';

export interface RuleValidationResult {
  ok: boolean;
  rule?: WebsiteRule;
  error?: string;
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function normalizeGuardDomain(value: string) {
  let domain = value.trim().toLowerCase();
  while (domain.endsWith('.')) domain = domain.slice(0, -1);
  if (
    !domain ||
    domain.length > 253 ||
    BLOCKED_HOSTS.has(domain) ||
    domain.includes('/') ||
    domain.includes(':')
  ) return null;
  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    )
  ) return null;
  return domain;
}

function isProtectedFocusFlowHost(hostname: string, port: string) {
  return (
    BLOCKED_HOSTS.has(hostname) ||
    ((hostname === 'localhost' || hostname === '127.0.0.1') && port === '3000')
  );
}

export function normalizeUrlPrefix(value: string) {
  try {
    const input = value.trim();
    if (input.includes('#')) return null;
    const url = new URL(input);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      isProtectedFocusFlowHost(url.hostname, url.port)
    ) return null;
    const domain = normalizeGuardDomain(url.hostname);
    if (!domain) return null;
    url.hostname = domain;
    return url.href;
  } catch {
    return null;
  }
}

export interface SafePattern {
  normalized: string;
  scheme: 'http' | 'https' | '*';
  domain: string;
  includeSubdomains: boolean;
  path: string;
}

export function normalizeSafePattern(value: string): SafePattern | null {
  const input = value.trim().toLowerCase();
  if (
    input.length > 2048 ||
    /[\s#\\\[\](){}|^$+]/.test(input)
  ) return null;
  const match = /^(https?|\*):\/\/((?:\*\.)?[^/]+)(\/.*)$/.exec(input);
  if (!match) return null;
  const includeSubdomains = match[2].startsWith('*.');
  const domain = normalizeGuardDomain(
    includeSubdomains ? match[2].slice(2) : match[2]
  );
  if (!domain) return null;
  const path = match[3];
  if (!path.startsWith('/') || path.includes('**') || path.includes('?')) {
    return null;
  }
  const scheme = match[1] as SafePattern['scheme'];
  return {
    normalized: `${scheme}://${includeSubdomains ? '*.' : ''}${domain}${path}`,
    scheme,
    domain,
    includeSubdomains,
    path,
  };
}

export function validateWebsiteRule(value: unknown): RuleValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Rule website tidak valid.' };
  }
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim().slice(0, 160) : '';
  const label = typeof raw.label === 'string'
    ? raw.label.trim().replace(/\s+/g, ' ').slice(0, 160)
    : '';
  if (!id || (raw.action !== 'block' && raw.action !== 'allow')) {
    return { ok: false, error: 'ID dan aksi rule wajib valid.' };
  }
  if (
    raw.matchType !== 'domain' &&
    raw.matchType !== 'url-prefix' &&
    raw.matchType !== 'url-pattern'
  ) return { ok: false, error: 'Tipe pencocokan tidak didukung.' };
  if (typeof raw.pattern !== 'string') {
    return { ok: false, error: 'Pola rule wajib diisi.' };
  }
  const pattern = raw.matchType === 'domain'
    ? normalizeGuardDomain(raw.pattern)
    : raw.matchType === 'url-prefix'
      ? normalizeUrlPrefix(raw.pattern)
      : normalizeSafePattern(raw.pattern)?.normalized ?? null;
  if (!pattern) {
    const message = raw.matchType === 'domain'
      ? 'Domain tidak valid atau merupakan origin FocusFlow.'
      : raw.matchType === 'url-prefix'
        ? 'URL prefix harus URL HTTP/HTTPS absolut yang aman.'
        : 'Pattern hanya boleh memakai safe glob, contoh *://*.youtube.com/shorts/*.';
    return { ok: false, error: message };
  }
  return {
    ok: true,
    rule: {
      id,
      pattern,
      matchType: raw.matchType,
      action: raw.action,
      ...(label ? { label } : {}),
    },
  };
}

export function websiteRuleEquivalentKey(rule: WebsiteRule) {
  return `${rule.matchType}:${rule.pattern.toLowerCase()}`;
}

export function normalizeWebsiteRuleSet(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) {
    return { ok: false as const, rules: [], error: 'Daftar rule tidak valid.' };
  }
  const rules: WebsiteRule[] = [];
  const ids = new Set<string>();
  const equivalents = new Set<string>();
  for (const item of value) {
    const checked = validateWebsiteRule(item);
    if (!checked.ok || !checked.rule) {
      return { ok: false as const, rules: [], error: checked.error };
    }
    const key = websiteRuleEquivalentKey(checked.rule);
    if (ids.has(checked.rule.id) || equivalents.has(key)) {
      return {
        ok: false as const,
        rules: [],
        error: 'Rule duplikat atau equivalent tidak diizinkan.',
      };
    }
    ids.add(checked.rule.id);
    equivalents.add(key);
    rules.push(checked.rule);
  }
  return { ok: true as const, rules };
}

export function deriveRuleOrigins(rules: WebsiteRule[]) {
  const origins = new Set<string>();
  for (const rule of rules) {
    if (rule.matchType === 'domain') {
      origins.add(`http://${rule.pattern}/*`);
      origins.add(`http://*.${rule.pattern}/*`);
      origins.add(`https://${rule.pattern}/*`);
      origins.add(`https://*.${rule.pattern}/*`);
      continue;
    }
    if (rule.matchType === 'url-prefix') {
      const url = new URL(rule.pattern);
      origins.add(`${url.protocol}//${url.hostname}/*`);
      continue;
    }
    const pattern = normalizeSafePattern(rule.pattern);
    if (!pattern) continue;
    const schemes = pattern.scheme === '*' ? ['http', 'https'] : [pattern.scheme];
    for (const scheme of schemes) {
      origins.add(`${scheme}://${pattern.domain}/*`);
      if (pattern.includeSubdomains) origins.add(`${scheme}://*.${pattern.domain}/*`);
    }
  }
  return Array.from(origins).sort();
}

function globRegex(pattern: SafePattern) {
  const scheme = pattern.scheme === '*' ? 'https?' : pattern.scheme;
  const host = pattern.includeSubdomains
    ? `(?:[^./]+\\.)*${pattern.domain.replace(/\./g, '\\.')}`
    : pattern.domain.replace(/\./g, '\\.');
  const path = pattern.path
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${scheme}://${host}${path}$`, 'i');
}

export function websiteRuleMatches(rule: WebsiteRule, rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (rule.matchType === 'domain') {
      return url.hostname === rule.pattern || url.hostname.endsWith(`.${rule.pattern}`);
    }
    if (rule.matchType === 'url-prefix') return url.href.startsWith(rule.pattern);
    const pattern = normalizeSafePattern(rule.pattern);
    return Boolean(pattern && globRegex(pattern).test(url.href));
  } catch {
    return false;
  }
}

export function ruleSpecificity(rule: WebsiteRule) {
  const literalLength = rule.pattern.replace(/\*/g, '').length;
  const base = rule.matchType === 'url-prefix' ? 3000 : rule.matchType === 'url-pattern' ? 2000 : 1000;
  return base + Math.min(literalLength, 900);
}

export function rulePriority(rule: WebsiteRule, index: number) {
  return ruleSpecificity(rule) * 1000 + (rule.action === 'allow' ? 100 : 0) + Math.min(index, 99);
}

export function resolveWebsiteRule(rules: WebsiteRule[], url: string): GuardRuleAction | null {
  const matches = rules
    .map((rule, index) => ({ rule, priority: rulePriority(rule, index) }))
    .filter(({ rule }) => websiteRuleMatches(rule, url))
    .sort((left, right) => right.priority - left.priority);
  return matches[0]?.rule.action ?? null;
}
