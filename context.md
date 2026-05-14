# Workshop Job Card App Context

This document is the implementation context for a simple workshop job card application built with **frontend + Supabase only**. There is no custom backend in version 1. Supabase will provide PostgreSQL storage, authentication, API access, and Row Level Security, while the frontend will handle the user interface and call Supabase directly.[1][2][3]

The system is based directly on the current paper job card used in the workshop. Version 1 must stay small and focused: create a job card, save it to the database, search historical records later, edit records, and close a job card when work is done.[4]

## Product Goal

Replace the paper job card with a digital record that can be created quickly and retrieved later by job card number, plate number, customer name, mobile number, or date.[4]

The goal of version 1 is not to build a full garage management platform. It is a searchable digital record system for workshop jobs.[4]

## Current Paper Job Card Fields

The current paper form contains these fields:[4]

- Date
- Job Card Number
- Customer Name
- Mobile
- Make
- Model
- Year
- Plate Number
- KM Reading
- Tyre Size Front
- Tyre Size Rear
- Spare Size
- Time In
- Time Out
- Technician Name

It also includes a "Work Carried Out" checklist with these service items:[4]

- Balancing
- Wheel Alignment
- Tyre Repair
- Mounting
- Oil Change
- Car Wash
- Polish

## Core Scope

Version 1 must support the following:

- Create a new job card.[4]
- Save job card data in Supabase Postgres.[1]
- Search old job cards by job card number, plate number, customer name, mobile number, and date.[4]
- View job card details.[4]
- Edit a saved job card.[4]
- Close a job card by setting `time_out` and updating status.[4]
- Support authenticated workshop users only through Supabase Auth and Row Level Security.[2][3]

Version 1 must not include inventory, billing, analytics, or complex workflow automation.[4]

## High-Level Architecture

Architecture for version 1:

- Frontend application
- Supabase project
  - PostgreSQL database
  - Auth
  - Row Level Security
  - Generated API access / client queries

The frontend will connect directly to Supabase using the Supabase client. Supabase provides API access to Postgres and supports Row Level Security for controlling access at the database level.[1][2]

## Supabase Responsibilities

Supabase is responsible for:

- PostgreSQL data storage.[1]
- Authentication.[5]
- Authorization using Row Level Security policies.[2][3]
- Query access from the frontend using the Supabase client or API.[1]
- Storing and retrieving all records for customers, vehicles, job cards, and services.[4]

### Supabase Setup Workflow

1. Create a new Supabase project.[5]
2. Save the project URL and anon key for frontend use.[1]
3. Never expose the service role key in frontend code.[1]
4. Create the required database tables.[4]
5. Seed the service catalog with the existing workshop service options.[4]
6. Enable Row Level Security on business tables.[2]
7. Create policies that allow authenticated users to read and write workshop records.[3]
8. Test queries using authenticated frontend sessions.[2]

## Database Design

### Tables

Create these tables:

- `profiles` or `users`
- `customers`
- `vehicles`
- `service_catalog`
- `job_cards`
- `job_card_services`

### `profiles`
Purpose: stores app user identity if needed beyond built-in auth metadata.

Suggested fields:
- `id`
- `email`
- `full_name`
- `role`
- `created_at`
- `updated_at`

### `customers`
Purpose: stores customer information.

Suggested fields:
- `id`
- `full_name`
- `mobile`
- `created_at`
- `updated_at`

### `vehicles`
Purpose: stores vehicle records linked to customers.

Suggested fields:
- `id`
- `customer_id`
- `plate_no`
- `make`
- `model`
- `year`
- `current_km_reading`
- `tyre_size_front`
- `tyre_size_rear`
- `spare_size`
- `created_at`
- `updated_at`

### `service_catalog`
Purpose: stores the fixed list of workshop service types.

Suggested fields:
- `id`
- `name`
- `active`
- `created_at`
- `updated_at`

### `job_cards`
Purpose: stores the main job card record.

Suggested fields:
- `id`
- `job_card_no`
- `customer_id`
- `vehicle_id`
- `job_date`
- `time_in`
- `time_out`
- `technician_name`
- `status`
- `notes`
- `created_by`
- `created_at`
- `updated_at`

### `job_card_services`
Purpose: join table between `job_cards` and `service_catalog`.

Suggested fields:
- `id`
- `job_card_id`
- `service_catalog_id`

## Data Relationships

- One customer can have many vehicles.[4]
- One vehicle belongs to one customer.[4]
- One vehicle can have many job cards over time.[4]
- One job card belongs to one customer and one vehicle.[4]
- One job card can have many service items.[4]

## Seed Data

Seed `service_catalog` with these exact initial values:[4]

- Balancing
- Wheel Alignment
- Tyre Repair
- Mounting
- Oil Change
- Car Wash
- Polish

The frontend must load this list from the database instead of duplicating the values manually in multiple places.[4]

## Business Rules

- A job card represents one workshop visit or one service session.[4]
- `job_card_no` must be unique.[4]
- `plate_no` is required and must be searchable.[4]
- `mobile` should be required for MVP if the workshop always records it.[4]
- `time_out` may remain null until the job is completed.[4]
- `km_reading` must be numeric and non-negative.[4]
- `year` must be numeric and validated to a reasonable range.[4]
- A job card can only reference valid customer, vehicle, and service records.[4]

## Status Model

Use these initial statuses:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED`
- `CLOSED`

Even though the paper job card does not show status, the digital system should use status for filtering, editing, and later reporting.[4]

## Security Model

Use Supabase Auth for login and Row Level Security for database access control. Supabase supports database-level authorization using RLS policies, and these policies should be applied to all business tables in the app.[2][3]

### MVP Security Rules

- Anonymous users must not access workshop business tables.[2]
- Authenticated users can read and write workshop data.[3]
- Service role key must never appear in the frontend code.[1]
- Later versions can add finer-grained admin/staff role policies if needed.[3]

## Frontend Responsibilities

The frontend is responsible for:

- Login UI using Supabase Auth.[5]
- Data entry forms for job cards.[4]
- Search and list UI for historical records.[4]
- Record detail pages.[4]
- Calling Supabase directly for CRUD operations.[1]
- Handling loading, error, and empty states.[6]
- Enforcing a clear form UX with labels, grouped fields, and inline validation messages.[6][7]

## Frontend Workflow

### Phase 1: App Foundation

- Create the frontend app.
- Add Supabase client setup.
- Create environment configuration for Supabase URL and anon key.
- Build routing/layout.
- Build login page.

### Phase 2: Reusable UI Components

Create reusable components for:

- Text input
- Number input
- Date input
- Time input
- Checkbox group
- Search/filter bar
- Table with pagination or paging support
- Status badge
- Empty state
- Error alert
- Confirmation dialog

### Phase 3: Core Screens

Build these pages first:

1. Login page
2. Dashboard page
3. Job card list/search page
4. Create job card page
5. Job card detail page
6. Edit/close job card page

### Phase 4: Integration

- Load service catalog from Supabase.
- Create customers, vehicles, and job cards using Supabase queries.
- Fetch job card lists.
- Fetch one detailed job card view with related customer, vehicle, and services.
- Support updates to technician name, status, and time out.

### Phase 5: Hardening

- Add loading states.
- Add error states.
- Add empty states.
- Add search filters.
- Add print-friendly detail view.
- Test auth-protected access.
- Test RLS behavior with real users.[8]

## Frontend Screen Specification

### 1. Login Page

Purpose: authenticate workshop users using Supabase Auth.[5]

Fields:
- Email or username, depending on auth method
- Password

### 2. Dashboard Page

Keep it simple. Show:
- open job cards count
- completed today count
- recent job cards
- quick search by plate number or mobile

### 3. Job Card List/Search Page

Display columns:
- job card number
- date
- customer name
- mobile
- plate number
- make/model
- technician name
- status
- actions

Filters:
- job card number
- plate number
- mobile
- customer name
- date range
- status

### 4. Create Job Card Page

Break the form into these sections:

1. Job Information
2. Customer Information
3. Vehicle Information
4. Work Carried Out
5. Completion Information

#### Section: Job Information
Fields:
- Date
- Job Card Number
- Time In
- Status (default `OPEN`)

#### Section: Customer Information
Fields:
- Full Name
- Mobile

Enhancement:
- Look up existing customer by mobile if available.

#### Section: Vehicle Information
Fields:
- Plate Number
- Make
- Model
- Year
- KM Reading
- Tyre Size Front
- Tyre Size Rear
- Spare Size

Enhancement:
- Look up existing vehicle by plate number if available.

#### Section: Work Carried Out
Render the service list as vertical checkboxes.[6][7]

Options:
- Balancing
- Wheel Alignment
- Tyre Repair
- Mounting
- Oil Change
- Car Wash
- Polish

#### Section: Completion Information
Fields:
- Technician Name
- Time Out
- Notes

### 5. Job Card Detail Page

Display a clean digital representation of the paper form.[4]

Should show:
- job card header
- customer block
- vehicle block
- selected services
- technician name
- time in/time out
- metadata such as created/updated timestamps
- print-friendly layout

### 6. Edit/Close Job Card Page

Use the same form structure as create page, prefilled with current data.

The close action should:
- set `time_out`
- update `status`
- save technician completion info

## Form UX Rules

- Every field must have a visible label.[6]
- Do not use placeholders as labels.[6][7]
- Show inline validation messages near each invalid field.[6]
- Use checkboxes for service selection because multiple services can be selected.[7]
- Keep the form mostly one-column for clarity, especially on mobile.[6][7]
- Group related fields together in clear sections.[6]
- Use action labels such as `Save Job Card`, `Update Job Card`, and `Close Job Card`.[6]

## Example Frontend Query Responsibilities

The frontend should support these operations through Supabase:

- create customer
- create vehicle
- create job card
- attach selected services to a job card
- fetch recent job cards
- search job cards by filters
- fetch one job card with related records
- update job card fields
- close a job card

## Suggested Implementation Order

1. Create Supabase project.[5]
2. Create schema and seed service catalog.[4]
3. Enable RLS and create MVP policies.[2][3]
4. Build login flow.[5]
5. Build create job card form.[4]
6. Build list/search page.[4]
7. Build detail page.[4]
8. Build edit/close job flow.[4]
9. Add print styling and final polish.[4]

## Suggested Team Split

### Supabase / Data Owner
Responsible for:
- project setup
- schema creation
- indexes
- seed data
- RLS policies
- auth configuration
- testing data access rules

### Frontend Owner
Responsible for:
- application shell
- auth UI
- page routing
- forms
- CRUD integration
- search UI
- detail/print view
- loading/error/empty states
- mobile usability

## Acceptance Criteria

Version 1 is acceptable when staff can:

- log in successfully using Supabase Auth.[5]
- create a job card matching the current paper process.[4]
- save it to Supabase Postgres.[1]
- search old records quickly.[4]
- view all details of a historical job card.[4]
- edit a job card.[4]
- close a job card with `time_out` and status update.[4]
- use the system without a custom backend service.[1]

## Constraints

- Do not add a custom backend in version 1.[1]
- Do not expose the service role key in the frontend.[1]
- Do not build inventory, billing, analytics, or advanced workflow modules yet.[4]
- Keep the app simple, searchable, and faithful to the current workshop process.[4]