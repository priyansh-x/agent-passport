export interface TimeConstraint {
  startHour: number;
  endHour: number;
  timezone?: string;
}

export interface DayConstraint {
  allowedDays: number[];
}

export interface Constraints {
  time?: TimeConstraint;
  days?: DayConstraint;
  ipAllowlist?: string[];
  maxActions?: number;
}

export function checkTimeConstraint(constraint: TimeConstraint, now = new Date()): boolean {
  const hour = now.getUTCHours();
  if (constraint.startHour <= constraint.endHour) {
    return hour >= constraint.startHour && hour < constraint.endHour;
  }
  return hour >= constraint.startHour || hour < constraint.endHour;
}

export function checkDayConstraint(constraint: DayConstraint, now = new Date()): boolean {
  return constraint.allowedDays.includes(now.getUTCDay());
}

export function checkConstraints(
  constraints: Constraints,
  context?: { ip?: string; actionCount?: number; now?: Date },
): { allowed: boolean; reason?: string } {
  const now = context?.now ?? new Date();

  if (constraints.time && !checkTimeConstraint(constraints.time, now)) {
    return { allowed: false, reason: `Outside allowed hours (${constraints.time.startHour}:00-${constraints.time.endHour}:00 UTC)` };
  }

  if (constraints.days && !checkDayConstraint(constraints.days, now)) {
    return { allowed: false, reason: `Not allowed on day ${now.getUTCDay()} (allowed: ${constraints.days.allowedDays.join(',')})` };
  }

  if (constraints.ipAllowlist && context?.ip) {
    if (!constraints.ipAllowlist.includes(context.ip)) {
      return { allowed: false, reason: `IP ${context.ip} not in allowlist` };
    }
  }

  if (constraints.maxActions != null && context?.actionCount != null) {
    if (context.actionCount >= constraints.maxActions) {
      return { allowed: false, reason: `Action limit reached (${constraints.maxActions})` };
    }
  }

  return { allowed: true };
}
