# UniSafe Authority Web Application

A unified React-based authority dashboard for the UniSafe project, combining the BMC civic-issue management dashboard with the Police missing-person and sighting-management dashboard.

This repository contains the **authority frontend**. The Flask AI backend and Supabase project are maintained separately in the existing UniSafe repository.

---

## 1. Project Overview

The application provides two department-specific dashboards:

### BMC Authority Dashboard
- Authority dashboard and overview.
- Civic-issue Kanban board.
- Ward and field-officer management.
- Civic heatmap.
- Notifications.

### Police Authority Dashboard
- Police dashboard and overview.
- Missing-person registration and case management.
- Missing-person case details.
- AI-based face-matching integration.
- Sighting review and verification.
- Police heatmap.
- Sighting notifications/inbox.

The application uses a shared authority login and displays department-specific modules based on the logged-in authority's department.

**Important:** The frontend provides department-specific navigation and UI. Existing backend authentication and authorization protections must remain in place; hiding a page or button is not a replacement for backend authorization.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build tool | Vite |
| Styling | Existing project CSS and styling setup |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| AI backend | Flask |
| Face recognition | InsightFace |
| Version control | Git and GitHub |

The Flask backend is not included in this repository.

---

## 3. Repository Structure

The main project structure is:

```text
UniSafe_Authority_Web/
│
├── database/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── bmc/
│   │   └── police/
│   │
│   ├── services/
│   │
│   ├── ...
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
└── vite.config.js
```

The `src/components/bmc/` and `src/components/police/` directories contain department-specific UI components. Shared functionality and API integration are maintained in their respective shared locations.

Refer to the actual source files when making changes rather than assuming that similarly named components have identical behaviour.

---

## 4. Work Completed So Far

The following functionality and UI work has been incorporated into the current application.

### Shared Application
- Combined the BMC and Police authority interfaces into one React application.
- Retained the existing authority login/session integration.
- Department-specific dashboard navigation.
- Shared profile dropdown and logout functionality.
- Removed the Citizen Portal button across the authority application.
- Simplified the profile dropdown to retain only the Logout option.

### BMC Dashboard
- Existing civic-issue dashboard and Kanban functionality.
- Ward and field-officer management.
- Civic heatmap module.
- Notifications.
- Existing BMC functionality should be preserved during further development.

### Police Dashboard
- Missing-person registration and case-management interface.
- Missing-person case details.
- Sighting review and verification workflow.
- AI matching integration through the Flask backend.
- Police heatmap module.
- Sighting notification/inbox functionality.

### Police Jurisdiction Restrictions

The missing-person module has station-level jurisdiction restrictions for Bandra and Andheri police authorities.

The intended behaviour is:

- Bandra authorities should access Bandra missing-person cases.
- Andheri authorities should access Andheri missing-person cases.
- Missing-person case registration derives the station jurisdiction from the authenticated authority.
- A case belonging to another station must not expose its restricted details or management controls.
- Police authorities can review sightings and their AI match candidates, but access to another station's case dossier remains restricted.

The Supabase RLS policies and Flask-side authorization checks are important parts of this implementation. Do not remove or bypass them.

### Recent UI Corrections
- Removed the Citizen Portal button across BMC and Police pages.
- Corrected corrupted characters in Kanban priority/category labels.
- Removed non-functional Dark Theme, SOP & Guidelines, and Control Room options from the profile dropdown.
- Kept the Logout functionality.

---

## 5. Important Areas — Please Do Not Modify Casually

This project contains existing work from multiple contributors. Please inspect the implementation and discuss changes before modifying shared or security-sensitive functionality.

### Authentication and Session Management
- Existing Supabase login implementation.
- Session handling.
- Logout functionality.
- Existing authority-to-department mapping.

Do not replace the login flow, change authentication settings, or introduce a new authentication system without discussion.

### Police Missing-Person Module
- Missing-person registration.
- Missing-person case details and API integration.
- AI candidate matching.
- Sighting review and verification.
- Case jurisdiction checks.

Do not modify the AI matching algorithm, embedding generation, matching thresholds, or existing API contracts without coordinating with the person responsible for that functionality.

### Supabase and Database
- Existing database schema and relationships.
- Missing-person jurisdiction column and policies.
- RLS policies for missing-person cases, embeddings, and sightings.
- Storage bucket policies.

Do not run SQL migrations, modify policies, change production data, or alter Supabase authentication settings without prior approval.

### Shared Components
Changes to shared layouts, navigation, API services, and authentication-related components can affect both BMC and Police dashboards.

Check both department dashboards after modifying shared components.

### Existing Work
- Preserve existing uncommitted changes.
- Do not reset, clean, stash, or overwrite another contributor's work.
- Do not commit or push another contributor's changes without coordination.

---

## 6. Running the Frontend Locally

### Prerequisites

Install:

- Node.js
- npm
- Git

### Step 1: Clone the repository

```bash
git clone https://github.com/itssmansi/UniSafe_Authority_Web_Application.git
```

Navigate into the project:

```bash
cd UniSafe_Authority_Web_Application
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Configure environment variables

Create a `.env` file in the project root using `.env.example` as a reference.

```bash
cp .env.example .env
```

On Windows, you can also create the file manually.

Fill in the required values using the existing project configuration and credentials shared through the appropriate secure channel.

**Never commit `.env` or share private keys through GitHub.** Do not use a Supabase service-role key in the browser frontend.

### Step 4: Start the development server

```bash
npm run dev
```

Vite will display the local development URL in the terminal. Open that URL in your browser.

The frontend development server and Flask backend are separate processes.

---

## 7. Flask Backend Dependency

**Important: The Flask AI backend is NOT included in this repository.**

The backend is maintained separately in:

```text
D:\UniSafe_fyp\flask_ai
```

The backend entry point is:

```text
flask_ai/app.py
```

The frontend uses the Flask API for backend operations, particularly missing-person registration, face recognition/matching, and sighting-related functionality.

### Why the backend may not run on another developer's machine

If you only clone `UniSafe_Authority_Web_Application`, you will not have:

- `flask_ai/app.py`
- Flask route modules.
- InsightFace integration.
- Backend Python dependencies.
- Backend environment configuration.

Therefore, frontend API requests that depend on Flask will fail if the backend is unavailable.

The frontend may display API errors or fail to complete AI-dependent workflows. A successful frontend build does not mean that the Flask backend is running.

### What Seana needs to run the complete application

Seana needs access to the existing UniSafe backend repository and its required configuration.

The backend should be obtained separately from the existing UniSafe repository. It should not be duplicated into this frontend repository.

Once access is available:

1. Open the Flask backend directory.
2. Set up the Python virtual environment.
3. Install the backend's required Python packages from its dependency file.
4. Configure the required backend environment variables securely.
5. Ensure the InsightFace model dependencies are available.
6. Start the Flask application using the existing backend instructions.
7. Keep the Flask server running while using the React frontend.

The actual Flask startup command and required environment variables should be taken from the current backend configuration. Do not assume that the frontend repository alone contains everything needed to start `app.py`.

### Vite API Proxy

The frontend uses the Vite development configuration for API requests.

Check `vite.config.js` and the API service configuration for the expected backend address and port.

If the Flask server is unavailable or the proxy target is incorrect, requests may return errors such as `502 Bad Gateway`.

For production deployment, the frontend must use the correct deployed Flask API URL rather than relying on a localhost development proxy.

---

## 8. Building the Frontend

To generate a production build:

```bash
npm run build
```

Vite generates the production output in:

```text
dist/
```

To preview the production build locally:

```bash
npm run preview
```

Remember:

- `npm run build` checks whether the frontend can be bundled.
- It does not start the Flask backend.
- It does not verify database connectivity, authentication, or AI matching.
- Full functionality must be tested with the required backend and Supabase configuration.

---

## 9. Testing Checklist

Before considering any changes complete, verify both departments.

### Shared
- [ ] Authority login works.
- [ ] Session persists correctly.
- [ ] Logout works.
- [ ] Profile dropdown displays correctly.
- [ ] No Citizen Portal button appears.
- [ ] Department-specific navigation is correct.

### BMC
- [ ] Dashboard loads.
- [ ] Kanban board displays correctly.
- [ ] Priority and category filters work.
- [ ] Ward and field-officer management works.
- [ ] Heatmap loads.
- [ ] Notifications work.

### Police
- [ ] Dashboard loads.
- [ ] Missing-person registration works.
- [ ] Missing-person list loads.
- [ ] Case details load for an authorized station.
- [ ] AI matching works with the Flask backend running.
- [ ] Sighting review and verification work.
- [ ] Cross-jurisdiction case access remains restricted.
- [ ] Heatmap and sighting inbox work.

### Build
- [ ] `npm run build` completes successfully.

---

## 10. Development Guidelines

1. Inspect existing components and services before implementing new functionality.
2. Reuse existing API services and components where appropriate.
3. Avoid duplicating API calls or introducing a second authentication flow.
4. Preserve existing backend authorization and Supabase RLS protections.
5. Test both BMC and Police dashboards after changes to shared components.
6. Keep frontend and backend responsibilities separate.
7. Do not commit credentials, `.env` files, or production secrets.
8. Coordinate before modifying another contributor's work or security-sensitive functionality.

---

## 11. Current Project Status

This repository is the unified authority frontend. It depends on the separately maintained UniSafe Flask backend and Supabase project for complete functionality.

Some features may require further testing and integration with the backend. Do not assume that a successful frontend build means every end-to-end workflow is complete.

**For any changes involving authentication, database policies, jurisdiction restrictions, AI matching, or existing API behaviour, coordinate with the contributor responsible for that functionality before making modifications.**