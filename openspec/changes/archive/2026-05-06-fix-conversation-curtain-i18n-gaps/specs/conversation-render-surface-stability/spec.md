## MODIFIED Requirements

### Requirement: Three-Engine Live Rendering MUST Preserve Progressive Visible Text

Live rendering for Codex, Claude Code, and Gemini MUST preserve progressive visible assistant text while allowing bounded throttling and safe degradation.

#### Scenario: conversation turn boundaries use locale-driven labels

- **WHEN** the curtain renders reasoning or final-message turn boundaries
- **THEN** user-visible labels MUST come from i18n resources
- **AND** the labels MUST update when the active locale changes
- **AND** the renderer MUST NOT hardcode Chinese copy as the primary production UI source
