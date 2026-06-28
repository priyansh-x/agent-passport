import type { SignedPassport, AuditEntry } from '@passport-agent/core';
import { PassportIssuer } from '@passport-agent/core';

export interface AgentConfig {
  name: string;
  role: string;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
}

export interface TaskDefinition {
  description: string;
  requiredPermission: string;
  spendAmount?: number;
  execute: () => unknown | Promise<unknown>;
}

export interface CrewConfig {
  principal: string;
  issuer: PassportIssuer;
  permissions: string[];
  limits?: { maxSpend: number; currency?: string };
}

export interface CrewResult {
  agent: string;
  task: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface PipelineResult {
  results: CrewResult[];
  completed: number;
  failed: number;
  totalSpent: number;
}

export class PassportAgent {
  readonly name: string;
  readonly role: string;
  private passport: SignedPassport;
  private issuer: PassportIssuer;

  constructor(config: AgentConfig, passport: SignedPassport, issuer: PassportIssuer) {
    this.name = config.name;
    this.role = config.role;
    this.passport = passport;
    this.issuer = issuer;
  }

  async executeTask(task: TaskDefinition): Promise<CrewResult> {
    const authResult = this.issuer.authorize(
      this.passport,
      task.requiredPermission,
      task.spendAmount ?? 0,
    );

    if (!authResult.allowed) {
      return {
        agent: this.name,
        task: task.description,
        success: false,
        error: `Denied: ${authResult.reason}`,
      };
    }

    try {
      const result = await task.execute();
      return { agent: this.name, task: task.description, success: true, result };
    } catch (e) {
      return {
        agent: this.name,
        task: task.description,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async executeTasks(tasks: TaskDefinition[]): Promise<CrewResult[]> {
    const results: CrewResult[] = [];
    for (const task of tasks) {
      results.push(await this.executeTask(task));
    }
    return results;
  }

  get passportId(): string {
    return this.passport.payload.id;
  }

  get permissions(): string[] {
    return this.passport.payload.permissions.map((p) => p.action);
  }

  get remainingBudget(): number {
    return this.passport.payload.limits.maxSpend - this.passport.payload.limits.spent;
  }

  delegate(childConfig: AgentConfig): PassportAgent {
    const childPassport = this.issuer.delegate(this.passport, {
      agent: `agent:${childConfig.name}`,
      permissions: childConfig.permissions,
      limits: childConfig.limits,
    });
    return new PassportAgent(childConfig, childPassport, this.issuer);
  }
}

export function createCrew(
  crewConfig: CrewConfig,
  agents: AgentConfig[],
): PassportAgent[] {
  const rootPassport = crewConfig.issuer.issue({
    principal: crewConfig.principal,
    agent: 'crew:root',
    permissions: crewConfig.permissions,
    limits: crewConfig.limits,
  });

  return agents.map((agentConfig) => {
    const agentPassport = crewConfig.issuer.delegate(rootPassport, {
      agent: `agent:${agentConfig.name}`,
      permissions: agentConfig.permissions,
      limits: agentConfig.limits,
    });
    return new PassportAgent(agentConfig, agentPassport, crewConfig.issuer);
  });
}

export interface PipelineStep {
  agent: PassportAgent;
  tasks: TaskDefinition[];
}

export async function runPipeline(
  steps: PipelineStep[],
  options?: { stopOnFailure?: boolean },
): Promise<PipelineResult> {
  const results: CrewResult[] = [];
  let completed = 0;
  let failed = 0;

  for (const step of steps) {
    for (const task of step.tasks) {
      const result = await step.agent.executeTask(task);
      results.push(result);
      if (result.success) {
        completed++;
      } else {
        failed++;
        if (options?.stopOnFailure) {
          return { results, completed, failed, totalSpent: 0 };
        }
      }
    }
  }

  return { results, completed, failed, totalSpent: 0 };
}
