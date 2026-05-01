# SuperVolcano Portal - Demo Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Purpose:** Comprehensive guide for demonstrating the SuperVolcano OEM Partner Portal to stakeholders, clients, and team members.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Test Credentials](#test-credentials)
4. [Quick Start](#quick-start)
5. [Demo Scenarios](#demo-scenarios)
6. [Feature Walkthroughs](#feature-walkthroughs)
7. [Known Issues](#known-issues)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The SuperVolcano Portal is a comprehensive management system for robot teleoperation operations. It consists of two main portals:

- **Admin Portal** (`/admin`): For SuperVolcano internal team to manage organizations, locations, tasks, and users
- **Organization Portal** (`/org`): For customer organizations (managers and teleoperators) to view analytics, manage tasks, and track performance

### Key Features

- **Role-Based Access Control**: Different interfaces for admins, organization managers, and teleoperators
- **Real-Time Analytics**: Dashboard metrics, top performers, and activity tracking
- **Automatic Session Tracking**: Sessions auto-create when tasks are completed (grouped by location and date)
- **Task Completion Tracking**: Support for recurring tasks with completion history
- **Location Management**: Assign locations to organizations, manage tasks and instructions
- **Team Management**: Add team members, assign roles, track performance

---

## Prerequisites

### Access Requirements

- Valid login credentials (see [Test Credentials](#test-credentials))
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

### Browser Setup

- **Recommended**: Chrome or Firefox (latest version)
- **Enable JavaScript**: Required for all functionality
- **Clear Cache**: If experiencing issues, clear browser cache and cookies

### System Requirements

- **Screen Resolution**: Minimum 1280x720 (1920x1080 recommended)
- **Mobile**: Responsive design works on tablets and phones

---

## Test Credentials

> **⚠️ IMPORTANT**: Replace placeholder credentials below with actual Firebase Authentication users.  
> **📝 NOTE**: Passwords are not stored in this document for security. Contact the system administrator for password information.

### Admin Users

**SuperAdmin / Admin**
- **Email**: `admin@demo.com` (or your admin email)
- **Password**: `[Contact administrator for password]`
- **Role**: `admin` or `superadmin`
- **Access**: Full system access, admin dashboard, all management features

**Alternative Admin**
- **Email**: `[Add actual admin email from Firebase]`
- **Password**: `[Contact administrator for password]`
- **Role**: `admin`
- **Access**: Full system access

### Organization Manager

**Org Manager**
- **Email**: `[Add actual org_manager email from Firebase]`
- **Password**: `[Contact administrator for password]`
- **Role**: `org_manager`
- **Organization**: `[Organization Name]`
- **Access**: Organization dashboard, team management, location analytics

**To Create New Org Manager**:
```bash
npx tsx scripts/create-org-manager.ts <email> <password> [organizationId]
```

### Teleoperator

**Test Teleoperator**
- **Email**: `teleoperator@demo.com` (or your test teleoperator email)
- **Password**: `[Contact administrator for password]`
- **Role**: `teleoperator`
- **Organization**: `[Organization Name]`
- **Access**: Task execution, location access, session tracking

**To Create New Teleoperator**:
```bash
npx tsx scripts/create-test-teleoperator.ts
```

### Partner Admin

**Partner Admin**
- **Email**: `[Add actual partner_admin email from Firebase]`
- **Password**: `[Contact administrator for password]`
- **Role**: `partner_admin`
- **Access**: Partner organization management

---

## Quick Start

### 1. Access the Portal

1. Navigate to: `https://your-vercel-deployment.vercel.app/login` (or `http://localhost:3000/login` for local)
2. Enter your credentials from the [Test Credentials](#test-credentials) section
3. Click **"Sign in"**

### 2. Expected Redirects

After login, you'll be automatically redirected based on your role:

- **Admin/SuperAdmin** → `/admin` (Admin Dashboard)
- **Org Manager** → `/org/dashboard` (Organization Dashboard)
- **Teleoperator** → `/org/dashboard` (Teleoperator Dashboard)
- **Partner Admin** → `/admin` (Admin Dashboard with partner scope)

### 3. First Steps

**For Admins:**
1. Review the admin dashboard metrics
2. Navigate to Organizations to view/create organizations
3. Check Locations to see assigned locations
4. Review recent activity and top performers

**For Org Managers:**
1. View organization dashboard with analytics
2. Check team members in the Team tab
3. Review locations assigned to your organization
4. Monitor task completion statistics

**For Teleoperators:**
1. View your dashboard with today's work summary
2. Navigate to Locations to see assigned locations
3. Select a location to view tasks
4. Complete tasks to start automatic session tracking

---

## Demo Scenarios

### Scenario 1: Admin Overview (5 minutes)

**Objective**: Demonstrate system-wide metrics and management capabilities

**Steps**:

1. **Login as Admin**
   - Use admin credentials
   - Expected: Redirect to `/admin` dashboard

2. **Review Dashboard Metrics**
   - **Overview Cards**: Organizations, Locations, Teleoperators, Total Tasks
   - **Activity Metrics**: Completions Today, Sessions Today, Total Work Time, Active Now
   - **Expected**: Real-time data from Firestore

3. **View Top Performers**
   - **Top Organizations**: Ranked by completions
   - **Recent Completions**: Latest task completions with status indicators
   - **Expected**: Clickable cards that navigate to detail pages

4. **Check Problem Areas**
   - **Locations Without Tasks**: Highlighted in orange
   - **Inactive Organizations**: Highlighted in yellow
   - **Expected**: Actionable items that need attention

5. **Quick Actions**
   - Click "Add Organization" → Navigate to organization creation
   - Click "Add Location" → Navigate to location creation
   - Click "Add User" → Navigate to user creation

**Expected Outcomes**:
- ✅ Dashboard displays real-time metrics
- ✅ All cards are clickable and navigate correctly
- ✅ Problem areas are clearly highlighted
- ✅ Quick actions work as expected

---

### Scenario 2: Organization Management (10 minutes)

**Objective**: Demonstrate creating and managing organizations

**Steps**:

1. **Navigate to Organizations**
   - Click "Organizations" in sidebar or click Organizations metric card
   - Expected: `/admin/organizations` page

2. **Create New Organization**
   - Click "Create Organization" button
   - Fill in form:
     - **Name**: "Demo Organization"
     - **Primary Manager Email**: `manager@demo.com`
     - **Primary Manager Name**: "Demo Manager"
     - **Status**: Active
   - Click "Create Organization"
   - **Expected**: Organization created, manager account created, redirect to organization detail page

3. **View Organization Details**
   - **Overview Tab**: Organization information, stats
   - **Locations Tab**: Assigned locations (can assign/unassign)
   - **Team Members Tab**: List of team members with roles
   - **Expected**: All tabs display correctly

4. **Add Team Member**
   - Go to "Team Members" tab
   - Click "Add Team Member"
   - Fill in:
     - **Email**: `teleoperator2@demo.com`
     - **Name**: "Test Teleoperator 2"
     - **Role**: Teleoperator (or Manager)
   - Click "Add"
   - **Expected**: Team member added, appears in list with role badge

5. **Assign Location to Organization**
   - Go to "Locations" tab
   - Click "Assign Location" or edit existing location
   - Select organization from dropdown
   - Save
   - **Expected**: Location appears in organization's locations list

**Expected Outcomes**:
- ✅ Organization creation includes manager creation
- ✅ Team members can be added with role selection
- ✅ Locations can be assigned to organizations
- ✅ All data persists correctly

---

### Scenario 3: Location and Task Management (10 minutes)

**Objective**: Demonstrate location setup and task creation

**Steps**:

1. **Navigate to Locations**
   - Click "Locations" in sidebar
   - Expected: `/admin/locations` page with location list

2. **Create New Location**
   - Click "Create Location" button
   - Fill in form:
     - **Name**: "Demo House"
     - **Address**: "123 Demo Street"
     - **Type**: Residential
     - **Contact Information**: Name, phone, email
     - **Access Instructions**: "Knock 3 times, code: 1234"
     - **Assigned Organization**: Select from dropdown
   - Click "Create Location"
   - **Expected**: Location created, redirect to location detail page

3. **Add Tasks to Location**
   - On location detail page, find "Tasks" section
   - Click "+ Create Task"
   - Fill in:
     - **Title**: "Clean Kitchen"
     - **Description**: "Clean all surfaces and appliances"
     - **Estimated Duration**: 30 minutes
     - **Priority**: High
   - Click "Create Task"
   - **Expected**: Task created, appears in tasks list

4. **Add Instructions to Task**
   - Expand the task card
   - Click "Add Instruction" or navigate to instructions
   - Fill in:
     - **Title**: "Wipe Countertops"
     - **Description**: "Use surface cleaner on all countertops"
     - **Step Number**: 1
   - Upload images if needed
   - Save
   - **Expected**: Instruction added, appears in task's instruction list

5. **Edit Location**
   - Click "Edit Location" button
   - Update any fields
   - Save
   - **Expected**: Changes persist correctly

**Expected Outcomes**:
- ✅ Locations can be created and assigned to organizations
- ✅ Tasks can be added to locations
- ✅ Instructions can be added to tasks with images
- ✅ All edits persist correctly

---

### Scenario 4: Teleoperator Task Completion (15 minutes)

**Objective**: Demonstrate task execution and automatic session tracking

**Steps**:

1. **Login as Teleoperator**
   - Use teleoperator credentials
   - Expected: Redirect to `/org/dashboard`

2. **View Dashboard**
   - **Today's Work**: Summary of today's session (if any)
   - **Recent Sessions**: List of recent work sessions
   - **Expected**: Dashboard shows teleoperator-specific view

3. **Navigate to Locations**
   - Click "Locations" in navigation
   - Expected: List of locations assigned to teleoperator's organization

4. **Select a Location**
   - Click on a location card
   - Expected: Location detail page with tasks

5. **View Tasks**
   - **All Tasks**: See all tasks (completed and incomplete)
   - **Filter Tabs**: "All", "Not Started", "In Progress"
   - **Expected**: Tasks display with completion status

6. **Complete a Task**
   - Click "Complete Task" button on a task
   - Fill in completion modal:
     - **Start Time**: When task was started
     - **End Time**: When task was completed
     - **Status**: Completed / Partial / Issues
     - **Notes**: Optional notes
     - **Issues**: Required if status is not "Completed"
   - Click "Submit Completion"
   - **Expected**: 
     - Task completion recorded
     - Session automatically created/updated
     - Task shows completion count and history
     - Success toast notification

7. **Complete Same Task Again (Recurring)**
   - Click "Complete Again" on the same task
   - Fill in completion details
   - Submit
   - **Expected**: 
     - Completion count increases (e.g., "2x today")
     - Completion history shows all completions
     - Task remains available for more completions

8. **View Completion History**
   - Expand a completed task
   - Scroll to "Completion History" section
   - **Expected**: See all completions for that task in today's session

9. **Check Session Summary**
   - Return to dashboard
   - View "Today's Work" section
   - **Expected**: Shows total tasks completed, total duration for today

**Expected Outcomes**:
- ✅ Tasks can be completed multiple times (recurring)
- ✅ Sessions auto-create when first task is completed
- ✅ Completion history is tracked and displayed
- ✅ Dashboard updates with session data
- ✅ All completions are recorded correctly

---

### Scenario 5: Organization Manager Analytics (10 minutes)

**Objective**: Demonstrate analytics and team management for org managers

**Steps**:

1. **Login as Org Manager**
   - Use org_manager credentials
   - Expected: Redirect to `/org/dashboard`

2. **View Manager Dashboard**
   - **Overview Metrics**: Total locations, team members, tasks completed
   - **Recent Activity**: Latest completions and sessions
   - **Top Locations**: Locations with most activity
   - **Expected**: Manager-specific analytics view

3. **View Team Members**
   - Click "Team" in navigation
   - **Expected**: List of all team members in organization
   - See role badges (Manager / Teleoperator)
   - View status and activity

4. **View Locations**
   - Click "Locations" in navigation
   - **Expected**: All locations assigned to organization
   - Click on location to view details
   - See tasks and completion status

5. **View Task History**
   - Click "Tasks" in navigation
   - **Expected**: All task completions for organization
   - Filter by date, location, teleoperator
   - View completion details

6. **Review Analytics**
   - Return to dashboard
   - Review completion trends
   - Check top performers
   - **Expected**: Data-driven insights for decision making

**Expected Outcomes**:
- ✅ Manager sees organization-wide analytics
- ✅ Team management features work correctly
- ✅ Location and task data is accessible
- ✅ Analytics provide actionable insights

---

## Feature Walkthroughs

### Admin Dashboard

**Location**: `/admin`

**Features**:
- **Overview Metrics**: System-wide counts (organizations, locations, teleoperators, tasks)
- **Activity Metrics**: Today's completions, sessions, work time, active sessions
- **Top Performers**: Top organizations ranked by completions
- **Recent Activity**: Latest task completions with status indicators
- **Problem Areas**: Locations without tasks, inactive organizations
- **Quick Actions**: Create organization, location, or user

**Navigation**:
- Click metric cards to navigate to detail pages
- Click organization cards to view organization details
- Click problem area items to fix issues
- Use sidebar for main navigation

---

### Organization Portal

**Location**: `/org`

**Features**:
- **Role-Based Views**: Different dashboards for managers and teleoperators
- **Dashboard**: Analytics, recent activity, session summaries
- **Locations**: List of assigned locations with task status
- **Team**: Team member management (managers only)
- **Tasks**: Task completion history

**Manager View**:
- Full analytics dashboard
- Team management
- All locations and tasks
- Performance insights

**Teleoperator View**:
- Simplified task execution interface
- Today's work summary
- Location and task access
- Session tracking

---

### Task Completion Flow

**Process**:
1. Teleoperator selects location
2. Views tasks (all tasks shown, completed ones highlighted)
3. Clicks "Complete Task" or "Complete Again"
4. Fills in completion modal:
   - Start and end times
   - Status (Completed/Partial/Issues)
   - Notes and issues
5. Submits completion
6. System automatically:
   - Creates/updates session for that location and date
   - Records completion
   - Updates dashboard metrics
   - Shows success notification

**Recurring Tasks**:
- Tasks can be completed multiple times per day
- Completion count displayed (e.g., "3x today")
- Completion history shows all completions
- "Complete Again" button always available

---

### Session Tracking

**Automatic Sessions**:
- Sessions auto-create when first task is completed at a location
- Grouped by: Teleoperator + Location + Calendar Day
- No manual "Start Session" or "End Session" required
- Session data includes:
  - Total tasks completed
  - Total duration
  - First task start time
  - Last task completion time

**Session Display**:
- Dashboard shows today's session summary
- Recent sessions list shows past sessions
- Session details available in analytics

---

## Known Issues

### Current Limitations

1. **Firestore Indexes**
   - Some queries may require composite indexes
   - If you see "FAILED_PRECONDITION" errors, create the suggested index in Firebase Console
   - The system gracefully handles missing indexes with in-memory sorting

2. **Session Date Boundaries**
   - Sessions are grouped by calendar day (midnight to midnight)
   - Tasks completed across midnight may create separate sessions

3. **Password Reset**
   - Use the reset script: `npx tsx scripts/reset-teleoperator-password.ts <email>`
   - Passwords must be set manually by admins

4. **Custom Claims**
   - After role changes, users must sign out and sign back in for claims to take effect
   - This is a Firebase Authentication limitation

### Browser Compatibility

- **Safari**: Some date/time pickers may have minor styling differences
- **Mobile**: Full functionality, but some features optimized for desktop

### Performance

- **Large Datasets**: Dashboard may take 2-3 seconds to load with many organizations/locations
- **Real-Time Updates**: Some metrics update on page refresh (not real-time streaming)

---

## Troubleshooting

### Login Issues

**Problem**: "Invalid credentials" error
- **Solution**: Verify email and password are correct
- **Solution**: Check that user exists in Firebase Authentication
- **Solution**: Ensure user has proper role claims set

**Problem**: Redirects to wrong page after login
- **Solution**: Sign out and sign back in (custom claims may need refresh)
- **Solution**: Check user's role in Firebase Authentication custom claims

### Dashboard Not Loading

**Problem**: Dashboard shows "Failed to load dashboard data"
- **Solution**: Check browser console for errors
- **Solution**: Verify API route is accessible
- **Solution**: Check Firebase permissions and rules

**Problem**: Metrics show zero or incorrect values
- **Solution**: Verify data exists in Firestore
- **Solution**: Check Firestore security rules allow read access
- **Solution**: Ensure proper indexes are created

### Task Completion Issues

**Problem**: "Session not found" error
- **Solution**: This should auto-create - check console for errors
- **Solution**: Verify location and organization are properly assigned
- **Solution**: Check Firestore rules allow session creation

**Problem**: Task completion doesn't appear
- **Solution**: Refresh the page
- **Solution**: Check browser console for API errors
- **Solution**: Verify task completion was successfully submitted

### Permission Errors

**Problem**: "Access Denied" or 403 errors
- **Solution**: Verify user has correct role
- **Solution**: Check Firestore security rules
- **Solution**: Ensure custom claims are set correctly

### Build/Deployment Issues

**Problem**: Build fails on Vercel
- **Solution**: Check environment variables are set correctly
- **Solution**: Verify Firebase Admin credentials are valid
- **Solution**: Check build logs for specific errors

**Problem**: API routes return 500 errors
- **Solution**: Check server logs in Vercel dashboard
- **Solution**: Verify Firebase Admin SDK is configured correctly
- **Solution**: Ensure environment variables are set in Vercel

---

## Getting Help

### Support Resources

- **Documentation**: See `README.md` for setup and architecture details
- **Testing Guide**: See `TESTING_CHECKLIST.md` for comprehensive test scenarios
- **Security Audit**: See `SECURITY_AUDIT.md` for security best practices

### Contact

- **Technical Issues**: Contact development team
- **Access Requests**: Contact system administrator
- **Feature Requests**: Submit through project management system

---

## Appendix

### Creating Test Users

**Create Org Manager**:
```bash
npx tsx scripts/create-org-manager.ts <email> <password> [organizationId]
```

**Create Teleoperator**:
```bash
npx tsx scripts/create-test-teleoperator.ts
```

**Reset Password**:
```bash
npx tsx scripts/reset-teleoperator-password.ts <email>
```

### Useful URLs

- **Local Development**: `http://localhost:3000`
- **Production**: `https://your-vercel-deployment.vercel.app`
- **Firebase Console**: `https://console.firebase.google.com`
- **Vercel Dashboard**: `https://vercel.com/dashboard`

---

**End of Demo Guide**

*Last Updated: 2024*  
*For questions or updates, contact the development team.*

