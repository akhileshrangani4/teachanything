<!--
Before opening a PR, please read CONTRIBUTING.md:
https://github.com/akhileshrangani4/teachanything/blob/main/CONTRIBUTING.md
Every PR should trace back to an issue you've agreed on first.
-->

## Summary

Brief description of what this PR does and why.

- Bullet points for key changes
- Reference the issue: Closes #123

## Changes

- What was added/modified/removed
- Any architectural decisions made and why

## Library Choices (if applicable)

If you introduced new dependencies, briefly explain:

- What you chose and why
- What alternatives you considered
- Maintenance status of the chosen library

## Screenshots (if visual changes)

Before/after screenshots or screen recordings for UI changes.

## Test Plan

- [ ] How to test the changes
- [ ] Edge cases considered
- [ ] What was manually verified

## Checklist

- [ ] PR title follows Conventional Commit format
- [ ] Linked to an issue (or context provided)
- [ ] `npm run lint` passes
- [ ] `npm run check-types` passes
- [ ] `npm run test` passes
- [ ] No `console.log` statements
- [ ] Zod validation on all new tRPC inputs
- [ ] Ownership checks on protected resources
- [ ] Screenshots attached for visual changes
- [ ] New dependencies justified in PR description
- [ ] Tests added for new utility/validation logic
- [ ] Database migrations generated (`npm run db:generate`) if schema changed
- [ ] I understand and can stand behind every change in this PR
