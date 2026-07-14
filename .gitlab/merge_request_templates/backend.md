# Backend change title

## Description
Describe what this backend change provides and which app flows it supports.

## Repository in scope
Backend:
- doomscrolling-tracker-backend

## Changes
- Backend setup or configuration changes
- API route changes
- Database or Prisma changes
- Dependency updates

## Breaking Changes
None

## Peer Test Guide
1. Run `npm install`
2. Run `npm run typecheck`
3. Run unit tests:
   ```bash
   npm test
   ```
4. Start the backend:
   ```bash
   npm run dev
   ```
5. Verify the affected API or backend behavior

## Rollback Plan
Revert this MR and restore the previous backend configuration.

## Checklist
- [ ] `npm install` completed successfully
- [ ] `npm run typecheck` passes
- [ ] Unit tests added or updated
- [ ] Unit tests pass
- [ ] Backend starts successfully
- [ ] Affected endpoints or backend behavior verified
