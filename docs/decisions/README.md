# Architecture decisions

Use an architecture decision record (ADR) for a durable choice that affects multiple features or constrains future implementation. Do not create ADRs for routine refactors, temporary experiments, or details already obvious from code.

Copy `0000-template.md`, assign the next four-digit number, and use a short kebab-case title. Keep old records immutable except for spelling or links; when a decision changes, add a new ADR and mark the old one superseded.

Current decisions:

- [0001 — Mobile data goes through the web API](0001-mobile-api-boundary.md)
