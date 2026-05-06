## MODIFIED Requirements

### Requirement: Thread Messaging Session Tooling Extraction Compatibility

The system SHALL preserve the effective command surface and user-visible outcomes when session-tooling commands are moved out of `useThreadMessaging` into a feature-local hook.

#### Scenario: Claude MCP route notice follows locale

- **WHEN** Claude route alias rewriting emits a user-visible MCP routing notice
- **THEN** the notice MUST use locale-driven copy
- **AND** English locale MUST NOT leak Chinese explanatory text
