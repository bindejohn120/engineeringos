import type { GuardrailTemplate } from './templates';

export const COMPLIANCE_GUARDRAILS: Record<string, GuardrailTemplate[]> = {
  GDPR: [
    {
      id: 'comp-gdpr-purpose-limitation',
      name: 'GDPR: Purpose limitation enforcement',
      category: 'compliance',
      applicableCompliance: ['gdpr'],
      severity: 'blocking',
      rule: 'Personal data collected for one specified purpose must not be repurposed without explicit consent or a compatible legal basis.',
      scope: ['**/user/**', '**/customer/**', '**/analytics/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: data collection endpoints must document their purpose and cross-purpose access must check consent records',
      ],
      reason: 'GDPR Article 5(1)(b) requires personal data be collected for specified, explicit, and legitimate purposes.',
      verification: [
        'Verify each data collection point documents its purpose and cross-purpose data access checks consent records',
      ],
    },
    {
      id: 'comp-gdpr-data-minimization',
      name: 'GDPR: Data minimization',
      category: 'compliance',
      applicableCompliance: ['gdpr'],
      severity: 'warning',
      rule: 'Forms and API endpoints collecting personal data must only request fields strictly necessary for the stated purpose.',
      scope: ['**/forms/**', '**/api/**', '**/dto/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Review: registration and intake forms must not collect optional personal data beyond what is required',
      ],
      reason: 'GDPR Article 5(1)(c) requires personal data be adequate, relevant, and limited to what is necessary.',
      verification: [
        'Verify forms and DTOs only contain fields documented as necessary for the stated processing purpose',
      ],
    },
    {
      id: 'comp-gdpr-consent-record',
      name: 'GDPR: Consent record keeping',
      category: 'compliance',
      applicableCompliance: ['gdpr'],
      severity: 'blocking',
      rule: 'Every consent-based processing activity must store an immutable consent record with timestamp, terms version, and scope of consent.',
      scope: ['**/consent/**', '**/user/**', '**/marketing/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: consent-related processing must create a consent record in an audit table',
      ],
      reason: 'GDPR Article 7 requires controllers to demonstrate that consent was given, with a verifiable record.',
      verification: [
        'Verify consent table stores user ID, consent scope, terms version, timestamp, and is append-only',
      ],
    },
    {
      id: 'comp-gdpr-breach-notification',
      name: 'GDPR: Breach notification workflow',
      category: 'compliance',
      applicableCompliance: ['gdpr'],
      severity: 'blocking',
      rule: 'Security incident handlers must trigger a breach notification workflow that can notify the supervisory authority within 72 hours.',
      scope: ['**/security/**', '**/incident/**', '**/alert/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: incident detection must trigger an automated notification pipeline with escalation',
      ],
      reason: 'GDPR Article 33 requires notification to the supervisory authority within 72 hours of becoming aware of a breach.',
      verification: [
        'Verify breach detection triggers a notification workflow with 72-hour SLA tracking',
      ],
    },
  ],

  PCI_DSS: [
    {
      id: 'comp-pci-network-segmentation',
      name: 'PCI-DSS: Cardholder data environment segmentation',
      category: 'compliance',
      applicableCompliance: ['pci-dss', 'pci'],
      severity: 'blocking',
      rule: 'Cardholder data must be stored in an isolated network segment. Application servers must not have direct access to the CDE without explicit authorization.',
      scope: ['**/config/**', '**/infrastructure/**', '**/*.tf'],
      forbiddenPatterns: [],
      enforcement: [
        'Infrastructure review: database and storage configurations must enforce network segmentation',
      ],
      reason: 'PCI-DSS Requirement 1.3 restricts direct public access between the internet and the cardholder data environment.',
      verification: [
        'Verify network configuration isolates cardholder data environment with explicit access rules',
      ],
    },
    {
      id: 'comp-pci-vulnerability-scan',
      name: 'PCI-DSS: Vulnerability scanning in CI/CD',
      category: 'compliance',
      applicableCompliance: ['pci-dss', 'pci'],
      severity: 'warning',
      rule: 'Dependency vulnerability scanning must run in CI/CD pipeline and block deployment on critical vulnerabilities.',
      scope: ['**/package.json', '**/.github/**', '**/Dockerfile'],
      forbiddenPatterns: [],
      enforcement: [
        'CI/CD review: pipeline must include a vulnerability scan step with failure on critical CVEs',
      ],
      reason: 'PCI-DSS Requirement 6.2 requires timely patching and vulnerability remediation for all systems.',
      verification: [
        'Verify CI/CD pipeline includes npm audit, Snyk, or equivalent scanner that blocks on critical findings',
      ],
    },
    {
      id: 'comp-pci-key-rotation',
      name: 'PCI-DSS: Cryptographic key rotation',
      category: 'compliance',
      applicableCompliance: ['pci-dss', 'pci'],
      severity: 'warning',
      rule: 'Encryption keys used for cardholder data must have a documented rotation schedule and automated rotation mechanism.',
      scope: ['**/config/**', '**/crypto/**', '**/vault/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Config review: encryption key configurations must specify a rotation period and auto-rotation mechanism',
      ],
      reason: 'PCI-DSS Requirement 3.6.4 requires key management procedures to include periodic key rotation.',
      verification: [
        'Verify encryption key configs include rotation period, auto-rotation trigger, and migration plan',
      ],
    },
    {
      id: 'comp-pci-access-control',
      name: 'PCI-DSS: Role-based access to cardholder data',
      category: 'compliance',
      applicableCompliance: ['pci-dss', 'pci'],
      severity: 'blocking',
      rule: 'Access to cardholder data must follow least-privilege principle with role-based access control and quarterly access reviews.',
      scope: ['**/auth/**', '**/rbac/**', '**/access/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: access control must use role-based permissions and support periodic review',
      ],
      reason: 'PCI-DSS Requirement 7 requires role-based access control and regular review of access privileges.',
      verification: [
        'Verify RBAC is enforced on CDE endpoints and access review mechanism exists',
      ],
    },
  ],

  HIPAA: [
    {
      id: 'comp-hipaa-audit-logging',
      name: 'HIPAA: Comprehensive audit logging',
      category: 'compliance',
      applicableCompliance: ['hipaa'],
      severity: 'blocking',
      rule: 'All access, modification, and deletion of PHI must be logged with user identity, timestamp, IP address, and action description.',
      scope: ['**/patient/**', '**/medical/**', '**/health/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: PHI access points must have audit logging middleware that captures user, time, IP, and action',
      ],
      reason: 'HIPAA Security Rule 164.312(b) requires audit controls to record and examine access to ePHI.',
      verification: [
        'Verify audit log entries contain user ID, timestamp, IP address, action type, and affected resource',
      ],
    },
    {
      id: 'comp-hipaa-transmission-encryption',
      name: 'HIPAA: PHI transmission encryption',
      category: 'compliance',
      applicableCompliance: ['hipaa'],
      severity: 'blocking',
      rule: 'PHI transmitted over networks must use TLS 1.2 or higher. HTTP (non-HTTPS) endpoints must not accept or return PHI.',
      scope: ['**/config/**', '**/server.ts', '**/app.ts'],
      forbiddenPatterns: [
        'http://',
        'allowHTTP',
        'HTTP_2_0',
      ],
      enforcement: [
        'Config review: server configuration must enforce TLS 1.2+ and reject unencrypted connections',
      ],
      reason: 'HIPAA Security Rule 164.312(e)(1) requires encryption of ePHI during electronic transmission.',
      verification: [
        'Verify server uses TLS 1.2+ and no PHI is transmitted over unencrypted connections',
      ],
    },
    {
      id: 'comp-hipaa-access-authorization',
      name: 'HIPAA: Role-based PHI access authorization',
      category: 'compliance',
      applicableCompliance: ['hipaa'],
      severity: 'blocking',
      rule: 'PHI access must be restricted to authorized personnel based on job function. Administrative, technical, and physical safeguards must be documented.',
      scope: ['**/auth/**', '**/rbac/**', '**/access-control/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: access control must implement role-based authorization for PHI resources',
      ],
      reason: 'HIPAA Security Rule 164.312(a)(1) requires access control that authorizes only specific persons for ePHI access.',
      verification: [
        'Verify PHI access endpoints enforce role-based authorization and unauthorized access returns 403',
      ],
    },
    {
      id: 'comp-hipaa-integrity-controls',
      name: 'HIPAA: PHI integrity controls',
      category: 'compliance',
      applicableCompliance: ['hipaa'],
      severity: 'warning',
      rule: 'PHI records must have integrity verification mechanisms such as checksums or versioning to detect unauthorized modification.',
      scope: ['**/patient/**', '**/medical/**', '**/health/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: PHI tables must include version fields or checksum columns for integrity verification',
      ],
      reason: 'HIPAA Security Rule 164.312(c)(1) requires policies and procedures to protect ePHI from improper alteration or destruction.',
      verification: [
        'Verify PHI records include version tracking or checksum fields and modification is audit-logged',
      ],
    },
  ],

  SOC2: [
    {
      id: 'comp-soc2-change-management',
      name: 'SOC2: Change management logging',
      category: 'compliance',
      applicableCompliance: ['soc2'],
      severity: 'warning',
      rule: 'All production configuration changes must be logged with author, timestamp, old value, and new value.',
      scope: ['**/config/**', '**/admin/**', '**/settings/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: configuration update endpoints must write to an audit log before applying changes',
      ],
      reason: 'SOC2 CC8.1 requires that changes to infrastructure, data, software, and procedures be authorized, tested, approved, and documented.',
      verification: [
        'Verify configuration changes are logged with author, timestamp, old value, and new value',
      ],
    },
    {
      id: 'comp-soc2-incident-response',
      name: 'SOC2: Incident response workflow',
      category: 'compliance',
      applicableCompliance: ['soc2'],
      severity: 'warning',
      rule: 'Security incidents must trigger a documented response workflow with severity classification, assignment, and resolution tracking.',
      scope: ['**/security/**', '**/incident/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: incident detection must create a structured incident record with severity and assignment',
      ],
      reason: 'SOC2 CC7.3 requires that the organization evaluates security events to determine incidents and responds appropriately.',
      verification: [
        'Verify incident records include severity classification, assigned responder, timeline, and resolution notes',
      ],
    },
    {
      id: 'comp-soc2-encryption-policy',
      name: 'SOC2: Encryption standard enforcement',
      category: 'compliance',
      applicableCompliance: ['soc2'],
      severity: 'blocking',
      rule: 'Sensitive data must be encrypted at rest (AES-256) and in transit (TLS 1.2+). Encryption must be verified in automated checks.',
      scope: ['**/config/**', '**/database/**', '**/storage/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Config review: database and storage configs must enable encryption; transport must use TLS 1.2+',
      ],
      reason: 'SOC2 CC6.7 requires restriction of access to system components and data to authorized users via encryption.',
      verification: [
        'Verify encryption-at-rest and encryption-in-transit are enabled and validated in config',
      ],
    },
  ],

  CCPA: [
    {
      id: 'comp-ccpa-collection-notice',
      name: 'CCPA: Collection notice at point of collection',
      category: 'compliance',
      applicableCompliance: ['ccpa'],
      severity: 'warning',
      rule: 'Every form collecting personal information must display a CCPA collection notice at the point of collection.',
      scope: ['**/forms/**', '**/components/**', '**/views/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Review: forms collecting PI must render a privacy notice link or banner',
      ],
      reason: 'CCPA 1798.100(b) requires businesses to inform consumers at or before the point of collection about the categories of PI collected and the purposes.',
      verification: [
        'Verify each data collection form displays a privacy notice with categories of PI and purposes',
      ],
    },
    {
      id: 'comp-ccpa-delete-request',
      name: 'CCPA: Consumer deletion request handling',
      category: 'compliance',
      applicableCompliance: ['ccpa'],
      severity: 'blocking',
      rule: 'Systems must implement a verifiable consumer deletion request endpoint that processes deletions within 45 days.',
      scope: ['**/user/**', '**/privacy/**', '**/consumer/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Architecture review: privacy module must expose a deletion request endpoint with confirmation workflow',
      ],
      reason: 'CCPA 1798.105 grants consumers the right to request deletion of personal information, with a 45-day response window.',
      verification: [
        'Verify deletion endpoint exists, sends confirmation, processes deletion within 45 days, and logs the action',
      ],
    },
    {
      id: 'comp-ccpa-non-discrimination',
      name: 'CCPA: Non-discrimination on privacy rights exercise',
      category: 'compliance',
      applicableCompliance: ['ccpa'],
      severity: 'warning',
      rule: 'Services must not degrade, charge differently, or deny service based on a consumer exercising CCPA rights.',
      scope: ['**/pricing/**', '**/billing/**', '**/subscription/**'],
      forbiddenPatterns: [],
      enforcement: [
        'Logic review: service quality and pricing must not branch on privacy preference or deletion status',
      ],
      reason: 'CCPA 1798.125 prohibits businesses from discriminating against consumers who exercise their CCPA rights.',
      verification: [
        'Verify service logic does not treat users differently based on privacy preferences or deletion requests',
      ],
    },
  ],
};
