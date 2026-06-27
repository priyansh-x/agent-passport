export interface Permission {
  action: string;
  resource?: string;
}

export interface SpendLimit {
  maxSpend: number;
  currency: string;
  spent: number;
}

export interface PassportPayload {
  id: string;
  iss: string;
  sub: string;
  principal: string;
  permissions: Permission[];
  limits: SpendLimit;
  iat: number;
  exp: number;
  parentId: string | null;
  nonce: string;
}

export interface SignedPassport {
  payload: PassportPayload;
  signature: string;
  publicKey: string;
}

export interface IssueOptions {
  principal: string;
  agent: string;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
  expiresIn?: number;
  issuer?: string;
}

export interface DelegateOptions {
  agent: string;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
  expiresIn?: number;
}

export interface AuthorizeResult {
  allowed: boolean;
  reason?: string;
  passportId: string;
}

export interface AuditEntry {
  timestamp: number;
  passportId: string;
  action: string;
  resource: string | undefined;
  allowed: boolean;
  reason: string | undefined;
}
