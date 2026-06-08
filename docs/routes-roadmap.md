# Routes Roadmap

This document outlines the transition of routes from the old format to the new multi-tenant format.

## Dashboard Routes

| Old Route | New Route |
| :--- | :--- |
| `/dashboard` | `/companies/${tenantId}/dashboard` |
| `/dashboard/accounting` | `/companies/${tenantId}/accounting` |
| `/dashboard/appointments` | `/companies/${tenantId}/appointments` |
| `/dashboard/clients` | `/companies/${tenantId}/clients` |
| `/dashboard/construction` | `/companies/${tenantId}/construction` |
| `/dashboard/contracts` | `/companies/${tenantId}/contracts` |
| `/dashboard/developer-hub` | `/companies/${tenantId}/developer-hub` |
| `/dashboard/employee-hub` | `/companies/${tenantId}/employee-hub` |
| `/dashboard/hr` | `/companies/${tenantId}/hr` |
| `/dashboard/notifications` | `/companies/${tenantId}/notifications` |
| `/dashboard/productivity` | `/companies/${tenantId}/productivity` |
| `/dashboard/projects` | `/companies/${tenantId}/projects` |
| `/dashboard/purchasing` | `/companies/${tenantId}/purchasing` |
| `/dashboard/quotations` | `/companies/${tenantId}/quotations` |
| `/dashboard/reports` | `/companies/${tenantId}/reports` |
| `/dashboard/settings` | `/companies/${tenantId}/settings` |
| `/dashboard/warehouse` | `/companies/${tenantId}/warehouse` |

## Nested Routes

| Old Route | New Route |
| :--- | :--- |
| `/dashboard/clients/[id]` | `/companies/${tenantId}/clients/[id]` |
| `/dashboard/appointments/[id]` | `/companies/${tenantId}/appointments/[id]` |
| `/dashboard/projects/[id]` | `/companies/${tenantId}/projects/[id]` |
| `/dashboard/quotations/[id]` | `/companies/${tenantId}/quotations/[id]` |

... and so on for all other nested routes.
