import type { PassportPayload } from './types.js';

export interface PassportDiff {
  permissionsAdded: string[];
  permissionsRemoved: string[];
  spendLimitChange: { from: number; to: number } | null;
  expiryChange: { from: number; to: number } | null;
  agentChange: { from: string; to: string } | null;
  isDelegation: boolean;
}

export function diffPassports(parent: PassportPayload, child: PassportPayload): PassportDiff {
  const parentPerms = new Set(parent.permissions.map((p) => p.action));
  const childPerms = new Set(child.permissions.map((p) => p.action));

  const permissionsAdded = [...childPerms].filter((p) => !parentPerms.has(p));
  const permissionsRemoved = [...parentPerms].filter((p) => !childPerms.has(p));

  const spendLimitChange =
    parent.limits.maxSpend !== child.limits.maxSpend
      ? { from: parent.limits.maxSpend, to: child.limits.maxSpend }
      : null;

  const expiryChange =
    parent.exp !== child.exp
      ? { from: parent.exp, to: child.exp }
      : null;

  const agentChange =
    parent.sub !== child.sub
      ? { from: parent.sub, to: child.sub }
      : null;

  return {
    permissionsAdded,
    permissionsRemoved,
    spendLimitChange,
    expiryChange,
    agentChange,
    isDelegation: child.parentId === parent.id,
  };
}
