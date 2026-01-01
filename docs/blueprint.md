# **App Name**: EmaratiScope

## Core Features:

- Client and Project Profiles: Create and manage client profiles with detailed contact information and associated project lists. Projects will have detailed profiles including assigned lead engineer, deadlines, project status, files, and engineering discipline information.
- Appointment Scheduling: Schedule site visits and client meetings linked to specific projects and engineers; log visit details (date, time, engineer, notes) in the project timeline and auto-count number of client visits.
- Smart Contracts and Invoicing: Create and manage contracts linked to projects, clients, and engineers; define multiple payment milestones and generate receivable invoices automatically upon milestone completion in the accounting module.
- Accounting and Inventory: Implement double-entry style accounting, track income and expenses, generate invoices, and manage financial reports. Additionally, monitor construction material stock levels and link material usage to specific projects with low-stock alerts.
- AI-Powered Project Timeline and Reporting: Generate and visualize project timelines with a Gantt-like interface; assign tasks to engineers, set deadlines, and automatically generate delay reports using AI tools if project phases exceed deadlines, for proactive monitoring and improved resource allocation.
- Mobile-Ready Progress Reporting: Engineers can submit daily site reports including work completed, number of workers, encountered issues, and photo uploads (stored in Firebase Storage) for better reporting on project progression.
- User Role Management: Implement role-based access control with Firebase Auth, managing access for admins, engineers, accountants, and clients.

## Style Guidelines:

- Primary color: Sky Blue (#4FC3F7) as requested by the user to evoke a sense of trust and reliability.
- Background color: Very light cyan (#E0F7FA). It is the same hue as the primary color, but much lighter.
- Accent color: Light teal (#4DD0E1), approximately 30 degrees 'left' of sky-blue on the color wheel, and set for good contrast.
- Headline font: 'Space Grotesk', sans-serif. Body font: 'Inter', sans-serif. Space Grotesk gives the page a computerized feel for headers, and Inter provides easily readable text in large amounts.
- Modern and consistent icon set relevant to construction and engineering, ensuring clear visual communication.
- Responsive design with Material UI or Tailwind CSS grid system, fully RTL-compatible for Arabic language support, and modular component design.
- Subtle transitions and animations to enhance user experience without being distracting.