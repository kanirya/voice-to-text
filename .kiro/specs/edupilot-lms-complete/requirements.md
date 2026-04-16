# Requirements Document

## Introduction

This specification covers completing the EduPilot Desktop App (Electron + Next.js) for Iqra University students. The app is a freshly cloned monorepo that needs project setup, a working Microsoft account login flow, a fully functional assignments tab (including file submission/patching), and a complete dashboard that surfaces courses, assignments, grades, and events from the LMS scraper service. The desktop app communicates with the LMS Scraper Service (localhost:8002) via a Next.js proxy rewrite (`/proxy/lms/*`).

## Glossary

- **Desktop_App**: The Electron + Next.js desktop application at `apps/desktop`
- **LMS_Scraper_Service**: Python/Playwright microservice at localhost:8002 that authenticates with Iqra University LMS via Microsoft OIDC and scrapes academic data
- **LMS_API_Client**: The `lmsApi` module in `apps/desktop/src/lib/lms-api.ts` that calls the LMS Scraper Service through the Next.js proxy
- **Assignment_Submission**: The process of uploading a file or text to the LMS for a specific assignment via the scraper service
- **Microsoft_Login**: Authentication using Iqra University Microsoft 365 credentials, handled by the LMS Scraper Service's Playwright-based OIDC flow with MFA number matching
- **Dashboard_Page**: The main landing page after login showing an overview of courses, assignments, grades, and upcoming events
- **Assignments_Page**: The page listing all assignments with filtering, status display, and file submission capability
- **Auth_Session**: The login session state maintained by the LMS Scraper Service (not JWT-based; the scraper holds a Playwright browser session)
- **TanStack_Query**: React Query library (already installed) for server state management, caching, and automatic refetching
- **Project_Setup**: The process of installing dependencies, configuring environment variables, and verifying the monorepo builds correctly

## Requirements

### Requirement 1: Project Setup and Build

**User Story:** As a developer, I want to set up the freshly cloned monorepo so that the desktop app and its dependencies build and run correctly.

#### Acceptance Criteria

1. WHEN a developer runs the install command at the monorepo root, THE Desktop_App SHALL resolve all workspace dependencies (`@edupilot/ui`, `@edupilot/types`, `@edupilot/api-client`, `@edupilot/utils`) without errors
2. WHEN the `.env` file is configured from `.env.example`, THE Desktop_App SHALL read `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_LMS_SCRAPER_URL` environment variables
3. WHEN the developer starts the desktop dev server, THE Desktop_App SHALL serve the Next.js app and open the Electron window
4. THE Desktop_App SHALL proxy requests from `/proxy/lms/*` to `http://localhost:8002/api/lms/*` via Next.js rewrites
5. IF a workspace package fails to resolve, THEN THE Desktop_App SHALL display a clear build error identifying the missing package

### Requirement 2: Microsoft Account Login

**User Story:** As a student, I want to log in with my Iqra University Microsoft 365 account on first launch so that the app authenticates with the LMS and loads my academic data.

#### Acceptance Criteria

1. WHEN the Desktop_App launches for the first time (no active Auth_Session), THE Desktop_App SHALL redirect the student to the login page
2. WHEN a student submits Microsoft 365 credentials (email and password), THE Desktop_App SHALL send the credentials to the LMS_Scraper_Service `/login` endpoint
3. WHEN the LMS_Scraper_Service returns `mfa_pending` status with a number, THE Desktop_App SHALL display the MFA number prominently and instruct the student to approve in Microsoft Authenticator
4. WHEN the LMS_Scraper_Service returns `logged_in` status with a profile, THE Desktop_App SHALL store the student profile locally and navigate to the Dashboard_Page within 2 seconds
5. IF the LMS_Scraper_Service returns `failed` status, THEN THE Desktop_App SHALL display the error message and allow the student to retry login
6. WHEN the student navigates to any protected page without an active Auth_Session, THE Desktop_App SHALL redirect to the login page
7. THE Desktop_App SHALL poll the LMS_Scraper_Service `/login/status` endpoint every 1.5 seconds during the login flow until a terminal status (`logged_in` or `failed`) is received

### Requirement 3: Assignment Listing and Filtering

**User Story:** As a student, I want to view all my assignments with filtering by course so that I can track due dates and submission status.

#### Acceptance Criteria

1. WHEN the Assignments_Page loads, THE Desktop_App SHALL fetch all assignments from the LMS_API_Client and display them grouped by status
2. WHEN a student selects a course from the course filter dropdown, THE Desktop_App SHALL fetch assignments for that specific course from the LMS_API_Client
3. THE Desktop_App SHALL display each assignment with its name, course name, due date, submission status, grade (when available), and time remaining
4. WHEN assignments are loading, THE Desktop_App SHALL display a loading indicator
5. IF the LMS_API_Client returns an error, THEN THE Desktop_App SHALL display the error message with guidance to check the LMS Scraper Service
6. THE Desktop_App SHALL use TanStack_Query for fetching assignments with a stale time of 60 seconds and automatic background refetching

### Requirement 4: Assignment Submission (File Upload / Patch)

**User Story:** As a student, I want to submit assignment files through the desktop app so that I can complete my coursework without opening the LMS website.

#### Acceptance Criteria

1. WHEN an assignment has `can_submit` set to true, THE Assignments_Page SHALL display a file input and submit button for that assignment
2. WHEN a student selects a file and clicks submit, THE Desktop_App SHALL send the file as FormData to the LMS_Scraper_Service `/assignments/{id}/submit` endpoint via POST
3. WHEN the LMS_Scraper_Service returns a success response, THE Desktop_App SHALL display a success message and refresh the assignment list to reflect the updated submission status
4. IF the student clicks submit without selecting a file, THEN THE Desktop_App SHALL display a validation message requesting file selection
5. IF the LMS_Scraper_Service returns a failure response, THEN THE Desktop_App SHALL display the error message from the response
6. WHILE a submission is in progress, THE Desktop_App SHALL disable the submit button and display a submitting indicator for that specific assignment
7. THE Desktop_App SHALL accept files with extensions: `.pdf`, `.doc`, `.docx`, `.txt`, `.zip`, `.py`, `.java`, `.cpp`, `.c`, `.xlsx`, `.pptx`
8. THE Desktop_App SHALL use React state (not mutable refs) for file input tracking to ensure proper re-render behavior

### Requirement 5: Dashboard Data Integration

**User Story:** As a student, I want the dashboard to show a complete overview of my courses, assignments, grades, and upcoming events so that I can see everything at a glance after logging in.

#### Acceptance Criteria

1. WHEN the Dashboard_Page loads, THE Desktop_App SHALL fetch profile, courses, grades, and events concurrently from the LMS_API_Client
2. THE Dashboard_Page SHALL display a stats row showing total courses count, upcoming events count, average grade percentage, and a link to assignments
3. THE Dashboard_Page SHALL display the top 5 courses with links to their assignments
4. THE Dashboard_Page SHALL display grades for each course with color coding (green for 80%+, yellow for 60-79%, red for below 60%)
5. THE Dashboard_Page SHALL display up to 6 upcoming events with icons based on event type (assignment, quiz, attendance)
6. WHEN a student clicks the "Sync LMS" button, THE Desktop_App SHALL call the LMS_API_Client `scrapeAll` endpoint and reload all dashboard data upon completion
7. IF any data fetch fails, THEN THE Dashboard_Page SHALL display an error message with a suggestion to check the LMS Scraper Service
8. THE Dashboard_Page SHALL use TanStack_Query for all data fetching with proper loading and error states

### Requirement 6: Auth Guard and Session Persistence

**User Story:** As a student, I want to stay logged in across app restarts so that I do not have to re-authenticate every time I open EduPilot.

#### Acceptance Criteria

1. WHEN the LMS_Scraper_Service confirms a successful login, THE Desktop_App SHALL persist the student profile in Electron's local storage via the preload bridge
2. WHEN the Desktop_App launches, THE Desktop_App SHALL check for a persisted profile and verify the Auth_Session is still active by calling the LMS_API_Client `/profile` endpoint
3. IF the stored session is still valid (profile endpoint returns data), THEN THE Desktop_App SHALL navigate directly to the Dashboard_Page
4. IF the stored session is expired or invalid (profile endpoint returns an error), THEN THE Desktop_App SHALL clear the persisted profile and redirect to the login page
5. WHEN a student clicks a logout action, THE Desktop_App SHALL call the LMS_API_Client `clearSession` endpoint, clear persisted data, and redirect to the login page

### Requirement 7: Professional UI and Visual Design

**User Story:** As a student, I want a clean, professional, and compact interface with a white theme so that the app feels polished and information-dense without visual clutter.

#### Acceptance Criteria

1. THE Desktop_App SHALL use a white/light theme as the primary color scheme across all pages with no gradient backgrounds on any surface or button
2. THE Desktop_App SHALL use compact spacing and small-scale typography (text-sm/text-xs base, tight padding) so that more information fits on screen without scrolling
3. THE Desktop_App SHALL use flat, solid-color buttons and badges with subtle borders instead of gradient or shadow-heavy styling
4. THE Dashboard_Page SHALL present stats, courses, grades, and events in a dense card grid layout with minimal whitespace between cards
5. THE Assignments_Page SHALL display assignments as compact rows with inline status badges, due dates, and actions rather than large expanded cards
6. THE Login page SHALL use a centered minimal card on a light neutral background with the EduPilot branding, no decorative gradients or heavy imagery
7. THE Sidebar SHALL use a slim fixed-width design (200-220px) with small icon+label navigation items and a subtle border separator instead of shadow
8. ALL interactive elements (buttons, dropdowns, inputs) SHALL use consistent border-radius (6-8px), consistent font sizes, and a cohesive neutral color palette (gray-50 through gray-900 with blue-600 as the primary accent)
9. THE Desktop_App SHALL use subtle hover states (background tint change) rather than elevation or shadow changes on interactive elements
10. THE Desktop_App SHALL display data tables and lists with alternating row tints or thin dividers for readability at compact sizes

### Requirement 8: Error Handling and Offline Resilience

**User Story:** As a student, I want clear error messages and graceful degradation when services are unavailable so that I understand what is happening and can take action.

#### Acceptance Criteria

1. IF the LMS_Scraper_Service is unreachable, THEN THE Desktop_App SHALL display a connection error with the message "LMS Scraper Service is not running on port 8002"
2. WHILE the Desktop_App is offline, THE Desktop_App SHALL display an offline indicator in the sidebar
3. WHILE the Desktop_App is offline, THE Desktop_App SHALL disable actions that require network access (sync, submit assignment, login)
4. WHEN a network request fails with a timeout, THE Desktop_App SHALL display a timeout error and offer a retry option
5. THE Desktop_App SHALL use TanStack_Query retry logic with 2 retries and exponential backoff for transient failures
