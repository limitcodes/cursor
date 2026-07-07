Keep components as plain as possible, inheriting global styles as the user fixed it; try not to make card-in-card UI and keep the app surface plain.

Performance is the primary metric. Never forget or ignore this. Prefer efficient primitives, avoid unnecessary renders, keep IPC payloads small, virtualize large views, and measure/optimize hot paths before adding visual complexity.

Project layout preference: start with multiple terminals and the file tree/file viewer first. The diff/active changes panel should live on the right side of the app.

Use pnpm for package management and project scripts.

When the user says "yeet", they mean: stage all changes, commit them with a concise descriptive message, and push to the current branch.

For React/codebase health checks, run `pnx react-doctor@latest --verbose`. React Doctor gives useful suggestions for performance, accessibility, bugs, and security. Current score can be low because it also includes pnpm security hardening warnings such as `minimumReleaseAge` and `trustPolicy`; do not blindly add those if they break the existing lockfile/install flow.
