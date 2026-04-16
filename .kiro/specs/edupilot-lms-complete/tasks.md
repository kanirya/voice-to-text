# Tasks

## Task 1: Project Setup and Build Configuration
- [x] 1.1 Verify workspace dependencies resolve: run install at monorepo root and confirm `@edupilot/ui`, `@edupilot/types`, `@edupilot/api-client`, `@edupilot/utils` resolve without errors
- [x] 1.2 Create `.env` file from `.env.example` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_LMS_SCRAPER_URL` variables
- [x] 1.3 Verify Next.js proxy rewrite in `apps/desktop/next.config.js` forwards `/proxy/lms/*` to `http://localhost:8002/api/lms/*`
- [x] 1.4 Verify desktop dev server starts correctly (Next.js + Electron)

## Task 2: TanStack Query Configuration
- [x] 2.1 Update `apps/desktop/src/app/providers.tsx` to add `retry: 2` and `retryDelay` with exponential backoff to `QueryClient` default options

## Task 3: Auth Guard and Session Persistence
- [x] 3.1 Create `apps/desktop/src/lib/hooks/use-lms-profile.ts` hook with `getProfile`, `setProfile`, `clearProfile` methods using `window.electron.setOfflineData`/`getOfflineData`
- [x] 3.2 Create `apps/desktop/src/components/AuthGuard.tsx` component that checks persisted profile, verifies session via `lmsApi.getProfile()`, and redirects to `/login` if invalid
- [x] 3.3 Update `apps/desktop/src/components/AppShell.tsx` to wrap protected routes with `AuthGuard`
- [x] 3.4 Update `apps/desktop/src/app/login/page.tsx` to persist profile via `window.electron.setOfflineData('lmsProfile', profile)` on successful login
- [x] 3.5 Update `apps/desktop/src/components/Sidebar.tsx` to add a logout button that calls `lmsApi.clearSession()`, clears persisted profile, and redirects to `/login`

## Task 4: Dashboard Page — TanStack Query Migration
- [x] 4.1 Refactor `apps/desktop/src/app/dashboard/page.tsx` to replace `useState`/`useEffect` data fetching with `useQuery` hooks for profile, courses, grades, and events
- [x] 4.2 Add `useMutation` for the Sync LMS button with `onSuccess` invalidating all `['lms', *]` queries
- [x] 4.3 Ensure dashboard displays stats row (courses count, upcoming events count, average grade %, assignments link), top 5 courses, grades with color coding, and up to 6 events

## Task 5: Assignments Page — Fix File Submission and TanStack Query Migration
- [x] 5.1 Replace `useRef<Record<number, HTMLInputElement>>` with `useState<Record<number, File | null>>({})` for file input tracking in `apps/desktop/src/app/assignments/page.tsx`
- [x] 5.2 Extract `isAllowedFileExtension()` utility function that validates filenames against the allowed extensions list (`.pdf`, `.doc`, `.docx`, `.txt`, `.zip`, `.py`, `.java`, `.cpp`, `.c`, `.xlsx`, `.pptx`)
- [x] 5.3 Refactor assignments page to use `useQuery` for fetching assignments (keyed by `['lms', 'assignments', selectedCourse]`) and `useMutation` for submission
- [x] 5.4 Add file type validation before submission — show error if file extension is not in the allowed list
- [x] 5.5 Ensure course filter dropdown works and changes the query key to refetch assignments for the selected course

## Task 6: Courses, Grades, Events Pages — TanStack Query Migration
- [x] 6.1 Refactor `apps/desktop/src/app/courses/page.tsx` to use `useQuery` instead of `useState`/`useEffect`
- [x] 6.2 Refactor `apps/desktop/src/app/grades/page.tsx` to use `useQuery` for grades overview and course grade detail
- [x] 6.3 Refactor `apps/desktop/src/app/events/page.tsx` to use `useQuery` for events

## Task 7: Professional UI and Visual Design — White Compact Theme
- [x] 7.1 Update `apps/desktop/src/app/login/page.tsx` styling: change background from `bg-gray-900` to `bg-gray-50`, use compact card with `border border-gray-200`, reduce title size, remove any gradient or heavy shadow classes
- [x] 7.2 Update `apps/desktop/src/components/Sidebar.tsx` styling: change from dark `bg-gray-900` to light `bg-white` with `border-r border-gray-200`, set width to `w-52`, update nav item active state to `bg-blue-50 text-blue-700`, hover to `hover:bg-gray-50`
- [x] 7.3 Update `apps/desktop/src/app/dashboard/page.tsx` styling: reduce page title to `text-lg font-semibold`, compact card padding to `p-3`, remove `hover:shadow-md` from cards, use `border border-gray-200` instead of shadows, reduce page padding
- [x] 7.4 Update `apps/desktop/src/app/assignments/page.tsx` styling: convert assignment cards to compact rows with inline status badges and actions, reduce padding, add alternating row tints with `even:bg-gray-50`
- [x] 7.5 Update `apps/desktop/src/app/courses/page.tsx` styling: compact card grid with `p-3` padding, flat buttons with borders, no shadow hover states
- [x] 7.6 Update `apps/desktop/src/app/grades/page.tsx` styling: add alternating row tints `bg-white`/`bg-gray-50` to grade table, compact cell padding
- [x] 7.7 Update `apps/desktop/src/app/events/page.tsx` styling: compact event cards with `p-3`, `space-y-2` spacing, subtle left border for type color
- [x] 7.8 Update `apps/desktop/src/app/settings/page.tsx` styling: compact cards, flat buttons, consistent border-radius and font sizes
- [x] 7.9 Update `apps/desktop/src/app/globals.css` if needed to ensure no global gradient or shadow overrides, verify base styles align with white theme

## Task 8: Error Handling and Offline Resilience
- [x] 8.1 Ensure `lmsFetch` in `apps/desktop/src/lib/lms-api.ts` detects connection refused / `TypeError` and throws a user-friendly "LMS Scraper Service is not running on port 8002" message
- [x] 8.2 Verify offline indicator displays in sidebar when `navigator.onLine` is false (already implemented via `useOffline`)
- [x] 8.3 Ensure sync button, submit button, and login form are disabled when offline
- [x] 8.4 Add timeout handling to `lmsFetch` using `AbortController` with a configurable timeout (e.g., 30s) and display "Request timed out" error with retry option

## Task 9: Utility Functions for Correctness Properties
- [x] 9.1 Extract `gradeColor()` function from dashboard/grades pages into a shared utility at `apps/desktop/src/lib/utils.ts` so it can be tested independently
- [x] 9.2 Extract `computeAverageGrade()` function into `apps/desktop/src/lib/utils.ts` that takes `LMSGrade[]` and returns the rounded average of non-null grades

## Task 10: Property-Based Tests
- [x] 10.1 Install `fast-check` as a dev dependency in `apps/desktop`
- [x] 10.2 Write property test for Property 1 (assignment card displays all non-null fields): generate random `LMSAssignment` objects, render card, assert all non-null fields appear
- [x] 10.3 Write property test for Property 2 (file extension validation): generate random filenames, run through `isAllowedFileExtension()`, assert correct accept/reject
- [x] 10.4 Write property test for Property 3 (average grade computation): generate random `LMSGrade[]` arrays, compute average, assert matches arithmetic mean
- [x] 10.5 Write property test for Property 4 (grade color coding): generate random numbers and null, run through `gradeColor()`, assert correct color class per range

## Task 11: Unit and Integration Tests
- [x] 11.1 Write unit tests for `AuthGuard` component: redirect when no session, render children when authenticated, redirect when session expired
- [x] 11.2 Write unit tests for login page: form submission, MFA display, success redirect with profile persistence, error display
- [x] 11.3 Write unit tests for assignments page: course filter, file selection state, submit validation, submission success
- [x] 11.4 Write unit tests for dashboard: queries fire on mount, sync button, error state
- [x] 11.5 Write snapshot tests for UI theme: verify login, dashboard, and assignments pages render with correct compact white theme classes (no gradients, no heavy shadows)
