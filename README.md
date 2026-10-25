# HCM Lite: AI-assisted Human Capital Management (Saylani Hackathon)

A web-based HR system with three roles (Admin, HR, Employee). The system starts completely empty: there is no preloaded or dummy data. Admin sets up the company, HR registers employees.

- **Live app:** https://YOUR-FRONTEND-URL.vercel.app
- **Live API:** https://final-hackathon-backend-olive.vercel.app (health check: `/health`)
- **Repository:** https://github.com/kaleemullah006/final-hackathon

## Stack

| Part | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS 4) |
| Backend | Node.js, Express 5 |
| Database | MongoDB Atlas (Mongoose 9) |
| Auth | JWT, bcrypt password hashing |
| Hosting | Vercel (frontend and backend) |

## How to create the first Admin

1. Open the live app. On a fresh install it goes to **/setup**.
2. Enter the company name and the Admin name, email and password (8+ characters).
3. Log in at **/login**.

Setup works only while there are no users. After that `POST /setup` returns 403.
(API: `GET /setup/status`, `POST /setup`.)

## How to run locally

Backend:

```bash
cd backend
npm install
cp .env.example .env     # then fill in the values
npm run dev              # http://localhost:5000
npm test                 # unit tests
```

Frontend:

```bash
cd frontend
npm install
# create .env.local with: NEXT_PUBLIC_API_URL=http://localhost:5000
npm run dev              # http://localhost:3000
```

### Environment variables (names only)

| File | Variable | Purpose |
|---|---|---|
| backend/.env | `MONGO_URI` | MongoDB connection string |
| backend/.env | `SECRET` | JWT signing secret |
| backend/.env | `FRONTEND_URL` | Allowed frontend origin(s) for CORS, comma separated |
| backend/.env | `PORT` | Local port (default 5000) |
| frontend/.env.local | `NEXT_PUBLIC_API_URL` | Backend base URL |

Real values are never committed. Only `.env.example` is in the repository.

## What is done

- **M1 Auth & Access:** JWT login, bcrypt passwords, three roles, server-side role guard on every protected route, deactivated users are rejected, temporary passwords force a change on first sign-in, change password.
- **First-run setup:** company and Admin account created from the app; public signup is removed.
- **M2 Organization setup (API):** company settings, departments, designations, leave types with standard quotas, public holidays. Admin manages, HR can view.
- **M3 Employees (API):** HR registers an employee (record and login are created together, temporary password is shown once), directory with server-side search, filters and paging, Employee 360, employee edits only own phone and address (salary is never shown to the employee), HR edits details and salary, marking an employee exited switches the login off. Admin creates HR logins, deactivates or reactivates logins, resets passwords.
- **M9 (partly):** append-only audit log (actor, action, entity, before/after) written for setup, create, update and reset actions. Passwords are never logged.
- **Security:** hashed passwords, role and data-scope checks on the server, CORS limited to `FRONTEND_URL`, no stack traces in error responses, secrets only in environment variables.
- **Tests:** unit tests for validation and rules (`npm test`).
- **Frontend screens:** first-run setup, login, change password, role-aware dashboard shell with logout.

## What is NOT done

- M4 Attendance (check-in/out, status rules, corrections)
- M5 Leave (apply, balance, approval)
- M6 Payroll and payslip PDF
- M7 Dashboards and analytics (the dashboard page is a placeholder)
- M8 AI assistant (chat, dashboard summary, smart leave, policy Q&A)
- M9 announcements and notifications; audit log viewer screen
- Frontend screens for organization setup and employees (the APIs exist and are tested, the pages are not built yet)
- CSV import/export, camera attendance (optional bonus)

## API overview

| Area | Endpoints |
|---|---|
| Setup | `GET /setup/status`, `POST /setup` |
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` |
| Org setup | `/settings`, `/departments`, `/designations`, `/leave-types`, `/holidays` |
| Employees | `POST /employees` (HR), `GET /employees` (Admin, HR), `GET /employees/:id` (Admin, HR), `PATCH /employees/:id` (HR), `GET` and `PATCH /employees/me` (Employee) |
| Users | `GET /users`, `POST /users/hr`, `PATCH /users/:id/active`, `POST /users/:id/reset-password` (Admin only) |

## AI key

The AI assistant is not implemented yet. When it is added, the key will be read only from a backend environment variable (`AI_API_KEY`) and never sent to the browser.
