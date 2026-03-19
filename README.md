# Solar CRM — React App

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev
# Opens at http://localhost:5173
```

## Project structure

```
src/
  config/
    dispositions.js   # All dispositions (ported from Streamlit)
    timeSlots.js      # Time slots (ported from Streamlit)
    stages.js         # All 11 pipeline stages + role access map

  context/
    AuthContext.jsx   # Auth + role helpers (useAuth hook)

  lib/
    supabase.js       # Supabase client (keys already set)
    phone.js          # cleanPhone(), formatPhone(), waLink() — ported from Streamlit
    leadService.js    # All lead DB operations
    assignment.js     # Round-robin assignment — ported from Streamlit

  components/
    layout/
      Layout.jsx      # Page wrapper with sidebar
      Sidebar.jsx     # Role-aware navigation
    ui/
      index.jsx       # Shared components: Badge, Modal, MetricCard, etc.

  pages/
    LoginPage.jsx
    DashboardPage.jsx
    TodayPage.jsx     # Today's callbacks + meetings (ported from Streamlit)
    LeadProfilePage.jsx
    PresalesPage.jsx  # Calling dashboard + Add Lead
    SalesPage.jsx
    FinancePage.jsx
    OpsPage.jsx
    AmcPage.jsx
    KanbanPage.jsx    # Manager pipeline view
    UsersPage.jsx     # Super admin user management
```

## Roles

| Role | Can see |
|------|---------|
| `presales_agent` | new, meeting_scheduled, qc_followup |
| `presales_manager` | same stages, all agents |
| `sales_agent` | meeting_scheduled → sale_closed |
| `sales_manager` | same, all agents |
| `finance_agent` | sale_closed, finance_approval |
| `finance_manager` | same + payment reports |
| `ops_agent` | finance_approval → installed |
| `ops_manager` | same + team view |
| `amc_agent` | installed, amc_active |
| `amc_manager` | same + renewals |
| `super_admin` | everything |

## Build for production

```bash
npm run build
# Output in /dist — deploy to Vercel, Netlify, or any static host
```
