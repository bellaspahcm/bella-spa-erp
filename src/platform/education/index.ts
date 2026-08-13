/**
 * Education OS — Module Exports
 */

export * from './domain/course.entity';
export * from './domain/enrollment.entity';
export * from './repositories/education-repository.interface';
export * from './repositories/supabase-education.repository';
export * from './education-engine.service';
export * from './education-engine.registration';

// Public Contracts & Implementations
export * from './contracts/course.contract';
export * from './contracts/course.contract.impl';
export * from './contracts/enrollment.contract';
export * from './contracts/enrollment.contract.impl';
export * from './contracts/student.contract';
export * from './contracts/student.contract.impl';
export * from './contracts/attendance.contract';
export * from './contracts/attendance.contract.impl';
export * from './contracts/assessment.contract';
export * from './contracts/assessment.contract.impl';
export * from './contracts/policy-registry.contract';
export * from './contracts/policy-registry.contract.impl';
export * from './contracts/workflow-registry.contract';
export * from './contracts/workflow-registry.contract.impl';
export * from './contracts/extension.contract';
export * from './contracts/extension.contract.impl';
