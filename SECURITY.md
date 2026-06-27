# Security Policy

## Reporting a Vulnerability

**Do NOT open a public issue for security vulnerabilities.**

Email: f20250479@pilani.bits-pilani.ac.in

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge within 48 hours and aim to release a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Scope

This project handles cryptographic tokens and authorization decisions. We take security seriously. Areas of particular concern:

- Token signing/verification bypass
- Permission escalation (violating monotonic narrowing)
- Revocation bypass
- Audit log tampering
