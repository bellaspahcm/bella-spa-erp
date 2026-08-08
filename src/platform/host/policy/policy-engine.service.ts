/**
 * Policy Engine Service
 * 
 * Verifies capability risk registry integrity and enforces governance invariants.
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module platform/host/policy
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { CapabilityRegistryService } from '../capability-registry';
import { GovernanceViolationError, type PolicyValidationResult } from './types';

export class PolicyEngineService {
  private static instance: PolicyEngineService | null = null;

  // Authoritative public key matching the private key used in generate-risk-registry.mjs
  private readonly publicKeyPem: string = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA9n062HNQWTM5Eo9xTf/f
yZ9kBsA7Jt6h9ARLcvFa0FSUCNmS5qer5HBPyZIgKIlo4dOLh2VXMCz30bKFQuyN
njdTy80q7W0h6gvqCKvkKV8WX+XUgLEvN2BhXl/fXY7CSVSbC1vuUZId3dWeCcNV
MMGCcAxjESJk610TNMdXvreZcrN6pb0jd95IkPOcEheOiShykQ1g1wkya5C7fWmY
vJLojqYheneVnKmqgdKOx7AE9cC+WzvMYtTeonvw15+SPFxJthEhoDhD1AXJOrM2
aLOKDKdFR7KnrKrycebSigcQFoqbyyf74+pn2Ws5pB4CgG9PK4umkaabm34Qx2Fi
DwIDAQAB
-----END PUBLIC KEY-----`;

  private constructor(
    private readonly capabilityRegistry: CapabilityRegistryService,
    private readonly matrixFilePath: string = 'docs/governance/HEALTHCARE_CAPABILITY_RISK_MATRIX.md'
  ) {}

  /**
   * Initialize PolicyEngineService singleton
   */
  public static initialize(
    capabilityRegistry: CapabilityRegistryService,
    matrixFilePath?: string
  ): PolicyEngineService {
    if (!PolicyEngineService.instance) {
      PolicyEngineService.instance = new PolicyEngineService(capabilityRegistry, matrixFilePath);
    }
    return PolicyEngineService.instance;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PolicyEngineService {
    if (!PolicyEngineService.instance) {
      throw new Error('PolicyEngineService not initialized. Call initialize() first.');
    }
    return PolicyEngineService.instance;
  }

  /**
   * Verifies the cryptographic integrity and authenticity of the database registry.
   * Compares the registry hash against the local matrix file and validates the signature.
   * 
   * @throws GovernanceViolationError if drift or signature failure is detected
   */
  public async verifyRegistryIntegrity(): Promise<boolean> {
    const capabilities = await this.capabilityRegistry.getAllCapabilities();
    if (capabilities.length === 0) {
      throw new GovernanceViolationError('Registry Integrity Failure: Capability Risk Registry table is empty.');
    }

    // Compute hash of the local matrix file to detect drift
    let localHash: string | null = null;
    const resolvedPath = path.resolve(this.matrixFilePath);
    if (fs.existsSync(resolvedPath)) {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      localHash = crypto.createHash('sha256').update(content).digest('hex');
    }

    for (const cap of capabilities) {
      // 1. Cryptographic Signature check (Authenticity)
      const verifier = crypto.createVerify('sha256');
      verifier.update(cap.generatedFromHash);
      verifier.end();

      const isSignatureValid = verifier.verify(this.publicKeyPem, cap.matrixSignature, 'hex');
      if (!isSignatureValid) {
        throw new GovernanceViolationError(
          `Provenance Integrity Failure: Invalid signature for capability '${cap.capabilityId}'. Classification has been tampered with or modified illegally.`
        );
      }

      // 2. Hash check (Drift detection)
      if (localHash && cap.generatedFromHash !== localHash) {
        throw new GovernanceViolationError(
          `Governance Drift Detected: Registry database hash for ${cap.capabilityId} (${cap.generatedFromHash}) does not match local frozen matrix hash (${localHash}).`
        );
      }
    }

    return true;
  }

  /**
   * Validates if a capability is allowed to deploy and operate based on approved classifications.
   * 
   * @param capabilityId Capability ID (e.g. 'HC-020')
   * @param runtimeTier Optional tier requested at runtime to assert tier alignment
   * @returns PolicyValidationResult representing validation status and metadata
   * @throws GovernanceViolationError if any invariant is violated
   */
  public async canDeploy(
    capabilityId: string,
    runtimeTier?: 'T1' | 'T2' | 'T3'
  ): Promise<PolicyValidationResult> {
    // 1. Verify registry database integrity
    await this.verifyRegistryIntegrity();

    // Invariant 1: No Classification, No Deployment
    const cap = await this.capabilityRegistry.getCapability(capabilityId);
    if (!cap) {
      throw new GovernanceViolationError(
        `Capability Blocked: Capability '${capabilityId}' is unregistered and has no approved classification in the database.`
      );
    }

    // Invariant 2: Provenance Integrity (re-verify signature for safety)
    const verifier = crypto.createVerify('sha256');
    verifier.update(cap.generatedFromHash);
    verifier.end();
    const isSigValid = verifier.verify(this.publicKeyPem, cap.matrixSignature, 'hex');
    if (!isSigValid) {
      throw new GovernanceViolationError(
        `Capability Blocked: Cryptographic signature validation failed for capability '${capabilityId}'.`
      );
    }

    // Invariant 3: Safety Profile Enforcement
    if (!cap.safetyProfile || cap.safetyProfile.trim() === '' || cap.safetyProfile === 'None') {
      throw new GovernanceViolationError(
        `Capability Blocked: Capability '${capabilityId}' has no valid Safety Profile defined.`
      );
    }

    // Invariant 4: Tier Invariant Verification
    if (runtimeTier && runtimeTier !== cap.finalTier) {
      throw new GovernanceViolationError(
        `Capability Blocked: Runtime tier mismatch for capability '${capabilityId}'. Registry mandates final tier '${cap.finalTier}' but runtime config is '${runtimeTier}'.`
      );
    }

    // Invariant 5: Policy Engine MUST NOT autonomously calculate Tiers.
    // Enforced since we return directly from registry DB: cap.finalTier, cap.rolloutPolicy, cap.safetyProfile.

    return {
      isValid: true,
      capabilityId: cap.capabilityId,
      finalTier: cap.finalTier,
      rolloutPolicy: cap.rolloutPolicy,
      safetyProfile: cap.safetyProfile,
      reason: 'Valid risk registry classification and provenance verified.',
      metadata: {
        governanceStatus: cap.governanceStatus,
        sourceVersion: cap.sourceVersion,
        riskScore: cap.riskScore
      }
    };
  }
}
