---
name: agent-best-practices
description: Apply evidence-based engineering practices when writing, modifying, debugging, or reviewing code. Use for implementation and code-review tasks that require repository awareness, proportionate verification, scope discipline, root-cause analysis, current documentation, regression prevention, secure handling, and careful git or external-state operations.
license: MIT
metadata:
  author: sceiler
  version: "2.0.0"
---

# Agent Best Practices

Use evidence from the real repository and runtime. Verify claims, respect the user's scope and authority, and prefer the smallest correct change.

## 1. Establish Context Before Acting

### `context-read-the-repo`

Read the repository's canonical agent instructions, relevant documentation, manifests, configuration, and surrounding code before proposing or making changes.

### `context-check-current-state`

Inspect the actual state involved in the task:

- Git branch, status, diff, base branch, and unrelated worktree changes
- Installed dependency and runtime versions
- Existing scripts, test setup, deployment configuration, and environment boundaries
- Current official documentation when APIs or platform behavior can drift

Do not edit an installed copy, generated artifact, or lookalike directory when the source of truth is elsewhere.

### `context-distinguish-authority`

Separate inspection from mutation. A request to explain, review, diagnose, or verify does not by itself authorize code changes, commits, pushes, deployments, configuration writes, or messages to third parties.

## 2. Verify in Proportion to Risk

### `verify-before-claiming`

Never call a change fixed or complete without relevant evidence. A plausible patch is a hypothesis until it has been exercised.

### `verify-use-native-checks`

Use the repository's own commands and required checks. Run targeted checks during iteration and the broader required suite before handoff when practical.

Choose checks that match the change:

- Code: lint, static analysis or typecheck, tests, and build as applicable
- UI: real browser behavior at implicated viewports, plus console and network errors
- API: real requests covering relevant success and failure paths
- Data: representative input and output that prove the calculation or transformation
- Deployment: the actual preview or production artifact when deployment is in scope

Do not invent a new test framework or run irrelevant expensive checks solely to satisfy a generic checklist.

### `verify-report-limits`

If a check cannot run because of time, tooling, credentials, environment, or missing infrastructure, state exactly what was and was not verified. Do not turn an inaccessible environment into a claim that the implementation works everywhere.

### `verify-separate-preexisting-failures`

Distinguish regressions caused by the task from pre-existing failures. Fix task-related failures. Report unrelated failures rather than silently expanding scope unless they block the requested outcome.

## 3. Respect Scope and Existing Work

### `scope-honor-the-request`

Treat words such as "only," "just," "simple," and "do not change" as explicit boundaries. Complete the requested outcome without unrelated refactors, features, dependencies, or cleanup.

### `scope-preserve-user-changes`

Assume existing worktree changes belong to the user unless proven otherwise. Do not overwrite, revert, reformat, commit, or include unrelated changes.

### `scope-suggest-separately`

Mention useful follow-up work separately. Do not implement it without authorization.

### `scope-no-implicit-external-actions`

Do not infer permission for commits, pushes, pull requests, deployments, production changes, account configuration, destructive operations, or third-party communication from a narrower request.

## 4. Find Root Causes

### `root-cause-trace-the-origin`

Trace symptoms through state, data flow, call sites, configuration, dependencies, and runtime behavior. Issues often surface far from their source.

### `root-cause-stop-repeating-fixes`

When an issue survives one attempted fix or repeats, stop applying surface patches. Reproduce it, inspect evidence, isolate the failing layer, and test the causal hypothesis.

### `root-cause-validate-data-assumptions`

State and verify assumptions such as cumulative versus incremental metrics, uniqueness, ordering, timezone, nullability, and environment-specific behavior before implementing derived logic.

## 5. Resolve Ambiguity Responsibly

### `clarify-investigate-first`

Resolve discoverable questions from repository state, current documentation, and safe read-only checks before asking the user.

### `clarify-ask-when-material`

Ask when a missing choice would materially change the result, scope, architecture, user experience, cost, security posture, or external state. Otherwise make a reasonable, reversible assumption and state it.

Do not block routine progress on preferences that can be inferred safely. Do not guess when the wrong assumption would be costly or difficult to undo.

## 6. Prevent Regressions

### `regression-trace-consumers`

Before changing a shared utility, schema, style, API, route, configuration value, or public identifier, find its consumers and compatibility requirements.

### `regression-test-behavior`

Test observable behavior and meaningful boundaries instead of implementation details or vanity coverage. Preserve canonical links and public contracts unless the task explicitly changes them; add migration or redirect paths when required.

### `regression-check-real-surfaces`

Automated checks do not replace runtime verification when the change is user-visible or environment-sensitive. Verify the actual surface implicated by the request.

## 7. Stay Current Without Forcing Upgrades

### `current-match-installed-versions`

Check manifests and lockfiles before using framework or library APIs. Prefer version-matched documentation, installed types, and source over remembered syntax.

### `current-use-primary-sources`

Use current official documentation, release notes, package repositories, and live platform behavior for unstable or recently changed features. Treat examples for other major versions as patterns, not proof.

### `current-upgrade-only-with-reason`

Do not update dependencies merely because newer versions exist. Upgrade when the requested outcome, compatibility, security, or measured performance justifies it, and verify migration impact.

## 8. Prefer Simple, Measurable Quality

### `quality-smallest-correct-change`

Prefer the smallest change that fully solves the problem. Avoid speculative abstraction, defensive code for impossible states, and configuration that has no current consumer.

### `quality-measure-performance`

Measure before optimizing. Consider code, configuration, framework versions, caching, infrastructure, and hardware as competing explanations; choose based on evidence rather than ideology.

### `quality-accessible-and-complete`

Treat accessibility, input validation, error handling, and complete syntax as part of correctness. Make snippets and patches unambiguous in their stated context.

## 9. Use Git and Automation Deliberately

### `workflow-honor-repo-conventions`

For code changes, determine the repository's branching and review workflow. Avoid committing directly to a default or protected branch unless explicitly permitted. Read-only tasks do not require creating or switching branches.

### `workflow-commit-only-in-scope`

Commit, push, or create a pull request only when the user request or named workflow includes those actions. Keep commits cohesive and exclude unrelated user changes.

### `workflow-avoid-destructive-history`

Do not force-push, rewrite history, discard changes, delete branches, merge, or deploy unless the task clearly authorizes that operation and the exact target is verified.

### `workflow-automate-repetition`

Suggest automation for repeated, error-prone work. Implement it only when it is within scope and the maintenance cost is justified.

## 10. Protect Security Boundaries

### `security-never-expose-secrets`

Never commit, print, quote, or return credentials. Resolve environment and authentication boundaries before declaring a secret missing or invalid.

### `security-validate-untrusted-input`

Validate data from users, APIs, files, environment variables, tools, and generated output at the appropriate trust boundary.

### `security-use-least-privilege`

Prefer narrowly scoped credentials, permissions, network access, and infrastructure controls. Do not weaken security controls merely to make a test pass.

## 11. Collaborate Clearly

### `collaboration-use-canonical-instructions`

Read and follow the repository's canonical instruction file. Update durable instructions only when the task calls for it, and avoid duplicating conflicting rules across files.

### `collaboration-lead-with-outcomes`

Report what changed, what evidence proves it, what remains uncertain, and where the result can be reviewed. Separate confirmed findings from hypotheses and recommendations.

### `collaboration-surface-material-tradeoffs`

Propose architecture choices with concrete tradeoffs. Ask for user direction when the choice is consequential; proceed with a safe, reversible default when it is not.

## Completion Checklist

- [ ] Did I inspect the real repository, versions, and affected surfaces?
- [ ] Did I stay within the requested authority and preserve unrelated work?
- [ ] Did I address the root cause rather than only the symptom?
- [ ] Did I use current, version-appropriate sources where behavior can drift?
- [ ] Did I run relevant repository-native verification and report its limits?
- [ ] Did I check regression, compatibility, accessibility, and security impact?
- [ ] Did I avoid unauthorized git, deployment, configuration, and third-party actions?
- [ ] Is the final report concrete, evidence-backed, and easy to review?
