const BASE = '/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface PassportData {
  id: string;
  sub: string;
  principal: string;
  permissions: { action: string }[];
  limits: { maxSpend: number; currency: string; spent: number };
  iat: number;
  exp: number;
  parentId: string | null;
}

export interface AuditEntry {
  passport_id: string;
  action: string;
  allowed: number;
  reason: string | null;
  timestamp: number;
}

export const api = {
  listPassports: () =>
    request<{ passports: PassportData[] }>('/passports'),

  getPassport: (id: string) =>
    request<{ passport: PassportData; revoked: boolean }>(`/passports/${id}`),

  issuePassport: (data: {
    principal: string;
    agent: string;
    permissions: string[];
    limits?: { maxSpend: number; currency?: string };
    expiresIn?: number;
  }) =>
    request<{ passport: PassportData; id: string }>('/passports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  revokePassport: (id: string) =>
    request<{ revoked: string[] }>(`/passports/${id}/revoke`, { method: 'POST' }),

  getAuditLog: (passportId?: string) =>
    passportId
      ? request<{ entries: AuditEntry[] }>(`/passports/${passportId}/audit`)
      : request<{ entries: AuditEntry[] }>('/audit?limit=100'),
};
