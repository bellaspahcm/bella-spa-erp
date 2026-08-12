/**
 * Ventilator Session Domain Entity
 * 
 * Constitution Compliance:
 * - Scoped as an internal Entity belonging to IcuStay Aggregate Root (NOT a standalone AR)
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Safety Validation: Validates ventilator parameter safety policies
 * 
 * @module platform/healthcare/engines/icu-engine/domain
 */

export interface VentilatorSettings {
  readonly fio2: number;            // Percentage (21 - 100%)
  readonly peep: number;            // cmH2O (0 - 25)
  readonly tidalVolume: number;     // mL (200 - 800)
  readonly respiratoryRate: number; // bpm (6 - 40)
  readonly pressureSupport: number; // cmH2O (0 - 30)
}

export interface VentilatorSafetyRules {
  readonly fio2: { readonly min: number; readonly max: number };
  readonly peep: { readonly min: number; readonly max: number };
  readonly tidalVolume: { readonly min: number; readonly max: number };
  readonly respiratoryRate: { readonly min: number; readonly max: number };
  readonly pressureSupport: { readonly min: number; readonly max: number };
}

export const DEFAULT_VENTILATOR_SAFETY_RULES: VentilatorSafetyRules = {
  fio2: { min: 21, max: 100 },
  peep: { min: 0, max: 25 },
  tidalVolume: { min: 200, max: 800 },
  respiratoryRate: { min: 6, max: 40 },
  pressureSupport: { min: 0, max: 30 },
};

export class VentilatorSafetyViolationError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Ventilator Safety Policy Violation: ${violations.join('; ')}`);
    this.name = 'VentilatorSafetyViolationError';
  }
}

export interface VentilatorSessionProps {
  readonly id: string;
  readonly icuStayId: string;
  readonly mode: 'AC' | 'SIMV' | 'CPAP' | 'PSV';
  readonly settings: VentilatorSettings;
  readonly startedAt: Date;
  readonly endedAt?: Date | null;
  readonly status: 'ACTIVE' | 'WEANING' | 'DISCONTINUED';
}

export class VentilatorSession {
  private _settings: VentilatorSettings;
  private _status: 'ACTIVE' | 'WEANING' | 'DISCONTINUED';
  private _endedAt: Date | null;

  private constructor(private readonly props: VentilatorSessionProps) {
    this._settings = props.settings;
    this._status = props.status;
    this._endedAt = props.endedAt || null;
  }

  get id(): string { return this.props.id; }
  get icuStayId(): string { return this.props.icuStayId; }
  get mode(): 'AC' | 'SIMV' | 'CPAP' | 'PSV' { return this.props.mode; }
  get settings(): VentilatorSettings { return this._settings; }
  get startedAt(): Date { return this.props.startedAt; }
  get endedAt(): Date | null { return this._endedAt; }
  get status(): 'ACTIVE' | 'WEANING' | 'DISCONTINUED' { return this._status; }

  static create(
    params: {
      id: string;
      icuStayId: string;
      mode: 'AC' | 'SIMV' | 'CPAP' | 'PSV';
      settings: VentilatorSettings;
      safetyRules?: VentilatorSafetyRules;
    }
  ): VentilatorSession {
    const rules = params.safetyRules || DEFAULT_VENTILATOR_SAFETY_RULES;
    const violations = VentilatorSession.validateSafety(params.settings, rules);

    if (violations.length > 0) {
      throw new VentilatorSafetyViolationError(violations);
    }

    return new VentilatorSession({
      id: params.id,
      icuStayId: params.icuStayId,
      mode: params.mode,
      settings: params.settings,
      startedAt: new Date(),
      status: 'ACTIVE',
    });
  }

  static reconstitute(props: VentilatorSessionProps): VentilatorSession {
    return new VentilatorSession(props);
  }

  static validateSafety(settings: VentilatorSettings, rules: VentilatorSafetyRules): string[] {
    const violations: string[] = [];

    if (settings.fio2 < rules.fio2.min || settings.fio2 > rules.fio2.max) {
      violations.push(`FiO2 ${settings.fio2}% violates allowed range [${rules.fio2.min}% - ${rules.fio2.max}%]`);
    }
    if (settings.peep < rules.peep.min || settings.peep > rules.peep.max) {
      violations.push(`PEEP ${settings.peep} cmH2O violates allowed range [${rules.peep.min} - ${rules.peep.max}]`);
    }
    if (settings.tidalVolume < rules.tidalVolume.min || settings.tidalVolume > rules.tidalVolume.max) {
      violations.push(`Tidal Volume ${settings.tidalVolume} mL violates allowed range [${rules.tidalVolume.min} - ${rules.tidalVolume.max}]`);
    }
    if (settings.respiratoryRate < rules.respiratoryRate.min || settings.respiratoryRate > rules.respiratoryRate.max) {
      violations.push(`Resp Rate ${settings.respiratoryRate} bpm violates allowed range [${rules.respiratoryRate.min} - ${rules.respiratoryRate.max}]`);
    }
    if (settings.pressureSupport < rules.pressureSupport.min || settings.pressureSupport > rules.pressureSupport.max) {
      violations.push(`Pressure Support ${settings.pressureSupport} cmH2O violates allowed range [${rules.pressureSupport.min} - ${rules.pressureSupport.max}]`);
    }

    return violations;
  }

  updateSettings(newSettings: VentilatorSettings, rules: VentilatorSafetyRules = DEFAULT_VENTILATOR_SAFETY_RULES): void {
    if (this._status === 'DISCONTINUED') {
      throw new Error('Cannot update settings on discontinued ventilator session');
    }

    const violations = VentilatorSession.validateSafety(newSettings, rules);
    if (violations.length > 0) {
      throw new VentilatorSafetyViolationError(violations);
    }

    this._settings = newSettings;
  }

  initiateWeaning(): void {
    if (this._status !== 'ACTIVE') {
      throw new Error(`Cannot initiate weaning from status ${this._status}`);
    }
    this._status = 'WEANING';
  }

  discontinue(): void {
    if (this._status === 'DISCONTINUED') {
      throw new Error('Ventilator session already discontinued');
    }
    this._status = 'DISCONTINUED';
    this._endedAt = new Date();
  }
}
