# Implementation Plan: Iqra University LMS Scraper (Microsoft Azure AD Auth)

## Overview

End-to-end implementation of a real-data scraper for Iqra University LMS (`https://lms.iqra.edu.pk`).
The LMS is **Moodle-based** and uses **Microsoft Azure AD OIDC** for authentication (no local username/password login).
The scraper uses Playwright to automate the full Microsoft login flow, then scrapes real student data
(courses, assignments, grades, announcements, schedule) and stores it in PostgreSQL with vector embeddings.

### Key Technical Facts
- LMS URL: `https://lms.iqra.edu.pk`
- Auth: Microsoft OIDC via `https://lms.iqra.edu.pk/auth/oidc/`
- Azure AD Client ID: `fbe1283b-3f94-4a03-a55c-5e4f0c086581`
- Microsoft login redirects back to `https://lms.iqra.edu.pk/auth/oidc/` after auth
- Platform: Moodle (standard Moodle HTML structure applies)
- Service location: `services/lms-scraper/`

---

## Tasks

- [x] 1. Investigate and document Iqra LMS structure
  - [x] 1.1 Map the Microsoft OIDC login flow
    - Use Playwright in headed mode to trace the full login sequence
    - Document exact selectors: email input, password input, "Next" button, "Sign in" button
    - Identify if MFA/conditional access is present
    - Document the redirect chain back to Moodle after successful auth
    - Save a Playwright trace file for reference
    - _Output: `services/lms-scraper/docs/login-flow.md` with step-by-step selectors_

  - [x] 1.2 Map Moodle dashboard and navigation structure
    - After login, document the dashboard URL and HTML structure
    - Identify the "My courses" section selector and course card structure
    - Document the Moodle session cookie name (`MoodleSession`)
    - Map URLs for: dashboard, my courses, course page, assignments, grades, calendar
    - _Output: `services/lms-scraper/docs/moodle-structure.md`_

  - [x] 1.3 Map course page structure
    - Navigate to an enrolled course page
    - Document the course sections, activity list selectors
    - Identify assignment activity links (`mod/assign`)
    - Identify forum/announcement activity links (`mod/forum`)
    - Document grade report URL pattern (`/grade/report/user/index.php?id=<courseid>`)
    - _Output: append to `services/lms-scraper/docs/moodle-structure.md`_

- [x] 2. Refactor authentication service for Microsoft OIDC
  - [x] 2.1 Replace username/password auth with Microsoft OIDC Playwright flow
    - Rewrite `services/lms-scraper/app/services/lms_auth.py`
    - Navigate to `https://lms.iqra.edu.pk/auth/oidc/?source=loginpage`
    - On Microsoft login page: fill email (`input[type="email"]`), click "Next"
    - Fill password (`input[type="password"]`), click "Sign in"
    - Handle "Stay signed in?" prompt — click "No" to avoid persistent session issues
    - Wait for redirect back to `https://lms.iqra.edu.pk` (URL no longer contains `microsoftonline.com`)
    - Verify login success by checking for Moodle dashboard elements
    - Store authenticated browser context for reuse across scrapers
    - _Requirements: Microsoft credentials stored as env vars `MS_EMAIL`, `MS_PASSWORD`_

  - [x] 2.2 Implement session persistence with cookie storage
    - After successful login, save browser cookies to a JSON file (`/tmp/moodle_session.json`)
    - On subsequent runs, load cookies and validate session before re-authenticating
    - Implement `is_session_valid()` by hitting `/my/` and checking for redirect to login
    - Fall back to full re-authentication if session is expired
    - _Reduces Microsoft login frequency and avoids rate limiting_

  - [x] 2.3 Add MFA/conditional access handling
    - Detect if Microsoft shows an MFA prompt (authenticator app, SMS code)
    - If MFA is not required (service account), document this clearly
    - If MFA prompt appears, raise `MFARequiredError` with clear message
    - Add config flag `SKIP_MFA_CHECK=true` for accounts without MFA
    - _Note: Use a dedicated service account without MFA for production_

  - [x] 2.4 Write auth integration test
    - Test full login flow against real LMS (requires env vars)
    - Assert session cookie `MoodleSession` is present after login
    - Assert dashboard URL is reached
    - Mark test as `@pytest.mark.integration` so it's skipped in CI without credentials

- [x] 3. Implement Moodle dashboard scraper
  - [x] 3.1 Scrape enrolled courses from dashboard
    - Navigate to `https://lms.iqra.edu.pk/my/`
    - Extract all course cards: course name, course URL, course ID (from URL `?id=<n>`)
    - Extract course short name / code from the card
    - Extract instructor name if visible
    - Return list of `CourseData` with real Moodle course IDs
    - _Moodle selector: `.coursebox`, `.course-info-container`, `[data-courseid]`_

  - [x] 3.2 Scrape course details page
    - For each course, navigate to `https://lms.iqra.edu.pk/course/view.php?id=<id>`
    - Extract course full name, short name, category, semester info
    - Extract list of sections and activity names
    - Extract enrolled teacher/instructor names from course header
    - Return enriched `CourseData` with all fields populated

  - [x] 3.3 Write unit tests for dashboard scraper
    - Mock Playwright page with sample Moodle HTML fixtures
    - Test course extraction with real Moodle HTML structure
    - Test handling of empty course list

- [x] 4. Implement assignments scraper
  - [x] 4.1 Discover all assignment activities across courses
    - For each enrolled course, navigate to course page
    - Find all assignment links: `a[href*="/mod/assign/view.php"]`
    - Extract assignment name, due date from course page activity list
    - Build list of assignment URLs to scrape

  - [x] 4.2 Scrape individual assignment details
    - Navigate to each assignment URL
    - Extract: title, description (`.box.generalbox`), due date (`.submissionstatustable`)
    - Extract: max grade, submission status (submitted/not submitted/late)
    - Extract: grading status and received grade if available
    - Parse Moodle date format: `"Sunday, 15 December 2024, 11:59 PM"`
    - Return `AssignmentData` with all real fields

  - [x] 4.3 Write unit tests for assignment scraper
    - Test date parsing for Moodle date format
    - Test extraction with sample assignment page HTML
    - Test handling of ungraded/no-submission assignments

- [x] 5. Implement grades scraper
  - [x] 5.1 Scrape grade overview report
    - Navigate to `https://lms.iqra.edu.pk/grade/report/overview/index.php`
    - Extract per-course grade summary: course name, grade, percentage
    - Handle "No grade" case gracefully

  - [x] 5.2 Scrape detailed grade report per course
    - For each course, navigate to `/grade/report/user/index.php?id=<courseid>`
    - Extract grade table: item name, grade, percentage, feedback
    - Map grade items to assignment names
    - Return `GradeData` list with course_id, item_name, grade, max_grade, percentage

  - [x] 5.3 Add `GradeData` model to `models.py`
    - Fields: `course_id`, `course_name`, `item_name`, `grade`, `max_grade`, `percentage`, `feedback`
    - Add `GradeData` to `ScrapingResult` response model

  - [x] 5.4 Write unit tests for grades scraper
    - Test grade table extraction
    - Test percentage calculation
    - Test handling of missing grades

- [x] 6. Implement announcements scraper
  - [x] 6.1 Scrape course announcements (forum posts)
    - For each course, find the "Announcements" forum: `a[href*="/mod/forum/view.php"]`
    - Navigate to the forum and extract all discussion threads
    - For each thread: title, author, date posted, first post content
    - Return `AnnouncementData` with real course_id and content

  - [x] 6.2 Scrape site-wide announcements
    - Check `https://lms.iqra.edu.pk/` for site announcements block
    - Extract any global announcements visible on dashboard
    - Tag these with `course_code = "SITE"`

  - [x] 6.3 Write unit tests for announcements scraper
    - Test forum thread extraction
    - Test date parsing for Moodle forum dates

- [x] 7. Implement calendar/schedule scraper
  - [x] 7.1 Scrape upcoming events from Moodle calendar
    - Navigate to `https://lms.iqra.edu.pk/calendar/view.php?view=month`
    - Extract all events: name, date, time, course, event type (assignment due, quiz, etc.)
    - Also fetch upcoming events from dashboard calendar block
    - Return `ScheduleEvent` list

  - [x] 7.2 Add `ScheduleEvent` model to `models.py`
    - Fields: `event_name`, `event_type`, `course_name`, `course_id`, `start_datetime`, `end_datetime`, `description`, `url`

  - [x] 7.3 Write unit tests for calendar scraper
    - Test event extraction from calendar page
    - Test event type classification

- [x] 8. Implement quiz/exam scraper
  - [x] 8.1 Discover quiz activities across courses
    - For each course, find quiz links: `a[href*="/mod/quiz/view.php"]`
    - Extract quiz name, open/close dates, attempt status
    - Return `QuizData` list

  - [x] 8.2 Add `QuizData` model to `models.py`
    - Fields: `course_id`, `quiz_name`, `opens_at`, `closes_at`, `time_limit`, `attempts_allowed`, `attempt_status`, `best_grade`

- [x] 9. Refactor scrapers.py with real Moodle selectors
  - [x] 9.1 Replace all placeholder selectors with real Moodle selectors
    - Update `scrape_courses()` with selectors from task 3.1
    - Update `scrape_assignments()` with selectors from task 4.1/4.2
    - Update `scrape_announcements()` with selectors from task 6.1
    - Update `scrape_grades()` with selectors from task 5.1/5.2
    - Update `scrape_schedule()` with selectors from task 7.1
    - Remove all `# TODO` comments and placeholder logic

  - [x] 9.2 Add comprehensive error handling per scraper
    - Wrap each scraper in try/except with specific error types
    - Log page URL and selector that failed
    - Return partial results rather than failing entirely
    - Add timeout handling: if page takes >30s, skip and log warning

  - [x] 9.3 Add scraper result validation
    - Validate that scraped data is non-empty and plausible
    - Log warning if 0 courses found (likely auth failure or page change)
    - Add sanity checks: course names should be non-empty strings, dates should be parseable

- [x] 10. Update data storage service
  - [x] 10.1 Update `data_storage.py` to store grades and schedule
    - Add `store_grades(student_id, grades)` method
    - Add `store_schedule_events(student_id, events)` method
    - Add `store_quizzes(student_id, quizzes)` method
    - Ensure upsert logic (update if exists, insert if new) using `ON CONFLICT DO UPDATE`

  - [x] 10.2 Update embedding generation for new data types
    - Generate embeddings for grade items: `"Grade for {item_name} in {course_name}: {grade}/{max_grade}"`
    - Generate embeddings for schedule events: `"Event: {name} on {date} for {course}"`
    - Store all embeddings in `document_embeddings` table with correct `source_type`

  - [x] 10.3 Add database migration for grades and schedule tables
    - Create `grades` table: `id, student_id, course_id, item_name, grade, max_grade, percentage, feedback, scraped_at`
    - Create `schedule_events` table: `id, student_id, event_name, event_type, course_id, start_datetime, end_datetime, description, url, scraped_at`
    - Create `quizzes` table: `id, student_id, course_id, quiz_name, opens_at, closes_at, attempt_status, best_grade, scraped_at`
    - Write migration file: `database/migrations/003_add_grades_schedule.sql`

- [x] 11. Update scraper router and API
  - [x] 11.1 Update `ScrapeRequest` model for Microsoft auth
    - Remove `lms_username` and `lms_password` fields (no longer used)
    - Add `ms_email: str` and `ms_password: str` fields (Microsoft credentials)
    - Or use service-level credentials from env vars (preferred for security)
    - Add `scrape_types: List[str]` field to allow selective scraping (courses, assignments, grades, etc.)

  - [x] 11.2 Update `perform_scraping()` background task
    - Call all scrapers: courses, assignments, grades, announcements, schedule, quizzes
    - Store all results via updated `data_storage.py`
    - Update `ScrapingResult` to include `grades_count`, `events_count`, `quizzes_count`
    - Add per-scraper timing metrics to logs

  - [x] 11.3 Add scraping result endpoint
    - `GET /api/scrape/results/{student_id}` — return last scraped data summary
    - `GET /api/scrape/courses/{student_id}` — return scraped courses
    - `GET /api/scrape/assignments/{student_id}` — return scraped assignments
    - `GET /api/scrape/grades/{student_id}` — return scraped grades

- [x] 12. Update configuration and environment
  - [x] 12.1 Update `config.py` for Microsoft auth settings
    - Add `ms_email: str` — Microsoft account email
    - Add `ms_password: str` — Microsoft account password
    - Add `ms_tenant_id: str = "organizations"` — Azure AD tenant
    - Add `session_storage_path: str = "/tmp/moodle_session.json"` — cookie persistence
    - Add `scrape_interval_hours: int = 6` — how often to re-scrape
    - Remove `lms_login_url` (no longer needed, OIDC URL is hardcoded)

  - [x] 12.2 Update `.env.example` with new variables
    - Add `MS_EMAIL=student@iqra.edu.pk`
    - Add `MS_PASSWORD=your_microsoft_password`
    - Add `SESSION_STORAGE_PATH=/tmp/moodle_session.json`
    - Document that these are Microsoft 365 credentials, not Moodle credentials

  - [x] 12.3 Update `docker-compose.yml` for new env vars
    - Add `MS_EMAIL` and `MS_PASSWORD` to lms-scraper service environment
    - Add `SESSION_STORAGE_PATH` env var
    - Add volume mount for session storage: `./data/sessions:/tmp`

- [x] 13. Add Playwright browser configuration for Microsoft login
  - [x] 13.1 Configure browser for Microsoft login compatibility
    - Set realistic user agent string (Chrome on Windows)
    - Set viewport to 1920x1080
    - Disable automation detection flags: `--disable-blink-features=AutomationControlled`
    - Set `navigator.webdriver = false` via page `addInitScript`
    - These prevent Microsoft from blocking automated logins

  - [x] 13.2 Handle Microsoft login page variations
    - Handle "Pick an account" page if multiple accounts are cached
    - Handle "Stay signed in?" prompt — always click "No"
    - Handle "Permissions requested" consent screen — click "Accept" if present
    - Handle password change prompts — raise `PasswordChangeRequiredError`
    - Add 2-second delays between form interactions to avoid bot detection

- [x] 14. Implement scraping scheduler integration
  - [x] 14.1 Update scheduler service to use new scraper API
    - Update `services/scheduler/app/jobs/scraping_jobs.py`
    - Change scrape request payload to use `ms_email`/`ms_password` from env
    - Schedule scraping every 6 hours per student
    - Add jitter (±30 minutes) to avoid all students scraping simultaneously

  - [x] 14.2 Add scraping health check to scheduler
    - After each scraping job, verify data was actually stored
    - If 0 courses returned, trigger re-authentication and retry once
    - Alert admin if scraping fails 3 consecutive times

- [x] 15. Write end-to-end integration tests
  - [x] 15.1 Write full scraping pipeline integration test
    - Test: authenticate → scrape courses → verify at least 1 course returned
    - Test: authenticate → scrape assignments → verify assignment data structure
    - Test: authenticate → scrape grades → verify grade data
    - Mark all as `@pytest.mark.integration` — requires real credentials
    - Add `pytest.ini` with `integration` marker registration

  - [x] 15.2 Write mock-based unit tests for full pipeline
    - Mock Playwright browser context with pre-recorded HTML fixtures
    - Test full `perform_scraping()` flow with mocked browser
    - Test error handling: auth failure, scraper timeout, storage failure
    - Achieve >80% code coverage on scraper service

  - [x] 15.3 Create HTML fixtures from real LMS pages
    - Save real Moodle page HTML for: dashboard, course page, assignment page, grades page
    - Store in `services/lms-scraper/tests/fixtures/`
    - Use these fixtures in unit tests to avoid hitting real LMS

- [x] 16. Update requirements and Dockerfile
  - [x] 16.1 Update `requirements.txt`
    - Add `msal==1.28.0` — Microsoft Authentication Library (for token-based fallback)
    - Add `pytest==7.4.0`, `pytest-asyncio==0.23.0`, `pytest-mock==3.12.0`
    - Add `pytest-playwright==0.4.4` — for Playwright-based tests
    - Ensure `playwright==1.41.0` is present (already in requirements)

  - [x] 16.2 Update `Dockerfile` for Playwright browser dependencies
    - Ensure Chromium browser is installed: `RUN playwright install chromium`
    - Install system dependencies: `RUN playwright install-deps chromium`
    - Add `--no-sandbox` flag support for containerized environments
    - Verify Dockerfile builds successfully

- [x] 17. Documentation
  - [x] 17.1 Write `services/lms-scraper/README.md`
    - Document Microsoft OIDC auth flow
    - Document all environment variables
    - Document API endpoints
    - Document how to run integration tests
    - Document known limitations (MFA, session expiry)

  - [x] 17.2 Write troubleshooting guide
    - Common issue: Microsoft blocks automated login → solution: use `--disable-blink-features`
    - Common issue: Session expired → solution: delete session file and re-authenticate
    - Common issue: Moodle selectors changed → solution: update selectors in `scrapers.py`
    - Document how to capture new HTML fixtures when LMS UI changes

---

## Implementation Order

Execute tasks in this order for fastest working implementation:
1. Task 1 (investigate) — understand real LMS structure first
2. Task 2 (auth) — get authentication working before anything else
3. Task 3 (courses) — simplest scraper, validates auth works
4. Task 12 (config) — update env vars in parallel with scrapers
5. Task 4 (assignments) — most important data for students
6. Task 5 (grades) — second most important
7. Task 6 (announcements) — straightforward forum scraping
8. Task 7 (schedule) — calendar events
9. Task 8 (quizzes) — additional data
10. Task 9 (refactor) — clean up all scrapers
11. Task 10 (storage) — update DB layer
12. Task 11 (API) — update endpoints
13. Task 13 (browser config) — harden against bot detection
14. Task 14 (scheduler) — wire up automated scheduling
15. Task 15 (tests) — integration and unit tests
16. Task 16 (deps) — update requirements/Dockerfile
17. Task 17 (docs) — documentation

---

## Notes

- All Microsoft credentials must be stored in environment variables, never hardcoded
- The scraper runs as a background service — students provide their Microsoft credentials once during onboarding
- Session cookies are persisted to avoid re-authenticating on every scrape
- All scraped data is stored in PostgreSQL and vector embeddings are generated for AI search
- The scraper is designed to be resilient: partial failures return partial data rather than failing entirely
- Moodle HTML structure is relatively stable but selectors should be verified after LMS updates
- Integration tests require real credentials and should only run in a secure CI environment
