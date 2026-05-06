## MODIFIED Requirements

### Requirement: Three-Engine Live Rendering MUST Preserve Progressive Visible Text

Live rendering for Codex, Claude Code, and Gemini MUST preserve progressive visible assistant text while allowing bounded throttling and safe degradation.

#### Scenario: generated image cards use locale-driven visible copy

- **WHEN** the curtain renders generated image title, status, hint, or preview action labels
- **THEN** those user-visible labels MUST come from i18n resources
- **AND** the renderer MUST NOT keep component-local hardcoded Chinese fallback copy for those surfaces

#### Scenario: agent badge accessibility label follows locale

- **WHEN** the curtain renders a user message agent badge toggle
- **THEN** its accessible label MUST come from i18n resources
- **AND** the label MUST include the selected agent name through interpolation when available
