import type { SignedPassport } from '@agent-passport/core';
import { PassportIssuer } from '@agent-passport/core';

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

  get passportId(): string {
    return this.passport.payload.id;
  }

  get permissions(): string[] {
    return this.passport.payload.permissions.map((p) => p.action);
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
