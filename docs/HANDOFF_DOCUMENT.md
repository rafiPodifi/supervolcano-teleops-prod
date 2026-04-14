# Super Volcano OEM Partner Portal - Handoff Document

## Product Overview

The **Super Volcano OEM Partner Portal** is a web application designed for managing teleoperator workflows, property/location management, and task assignments. The system supports two primary user roles:

1. **Admin Users**: Can create and manage locations (properties), assign tasks, create task templates, and view session data
2. **Operator Users**: Can view assigned locations, complete tasks, and manage sessions

### Key Features

- **Location Management**: Create, edit, and manage locations (formerly called "properties")
- **Task Management**: Create tasks from templates, assign to operators, track completion
- **Session Management**: Track operator sessions for quality control and reporting
- **Media Management**: Upload and manage photos/videos for locations
- **Template System**: Reusable task templates for standardized workflows
- **Role-Based Access**: Admin and operator roles with different permissions

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI Components**: Custom components built with Tailwind CSS
- **State Management**: React hooks (useState, useEffect, custom hooks)
- **Forms**: React Hook Form (implied from form handling)
- **Notifications**: react-hot-toast

### Backend
- **Database**: Firebase Firestore (Native mode, `nam5` multi-region)
- **Authentication**: Firebase Authentication with custom claims
- **Storage**: Firebase Storage for media files
- **API Routes**: Next.js API routes for server-side operations

### Deployment
- **Hosting**: Vercel (push-to-deploy from GitHub)
- **Repository**: GitHub (private)

## Architecture

### Application Structure

```
supervolcano-teleoperator-portal/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (operator)/         # Operator-facing routes
│   │   │   ├── properties/      # Location list view
│   │   │   ├── property/[id]/   # Location detail view
│   │   │   ├── tasks/          # Task list view
│   │   │   └── task/[id]/      # Task detail view
│   │   ├── admin/               # Admin-only routes
│   │   │   ├── page.tsx         # Admin dashboard
│   │   │   ├── properties/      # Location management
│   │   │   ├── tasks/           # Task management
│   │   │   └── sessions/        # Session management
│   │   └── api/                 # API routes
│   │       ├── session/         # Session start/stop endpoints
│   │       └── admin/           # Admin operations (seed, export)
│   ├── components/              # React components
│   │   ├── admin/               # Admin-specific components
│   │   ├── common/               # Shared components
│   │   └── ui/                   # UI primitives (buttons, cards, etc.)
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.tsx          # Authentication hook
│   │   ├── useProperties.ts     # Location data hook
│   │   ├── useCollection.ts     # Generic Firestore collection hook
│   │   └── useDoc.ts            # Generic Firestore document hook
│   ├── lib/                      # Utility libraries
│   │   ├── firebaseClient.ts    # Firebase client initialization
│   │   ├── firebaseAdmin.ts      # Firebase Admin SDK (server-side)
│   │   ├── repositories/         # Data access layer
│   │   │   ├── propertiesRepo.ts # Location CRUD operations
│   │   │   └── tasksRepo.ts      # Task CRUD operations
│   │   ├── types.ts              # TypeScript type definitions
│   │   └── format.ts             # Utility functions (date formatting, etc.)
│   └── firebase/                 # Firebase configuration
│       ├── firestore.rules       # Firestore security rules
│       └── storage.rules         # Storage security rules
├── scripts/                      # Utility scripts
│   ├── set-admin-role.ts         # Set admin role for users
│   ├── migrate-to-locations.ts   # Migration script (properties → locations)
│   └── check-locations.ts        # Diagnostic script
└── firestore.indexes.json        # Firestore composite indexes

```

## Database Schema

### Collections

#### `locations` (formerly `properties`)
```typescript
{
  id: string;                    // Firestore document ID (UUID)
  name: string;                  // Location name
  partnerOrgId: string;          // Partner organization ID
  address?: string;              // Physical address
  description?: string;           // Description
  images: string[];               // Array of image URLs
  media: PropertyMediaItem[];     // Full media objects with metadata
  imageCount: number;             // Count of images
  videoCount: number;             // Count of videos
  status: "scheduled" | "unassigned";
  isActive: boolean;              // Soft delete flag
  taskCount: number;              // Number of tasks
  createdBy?: string;             // User UID who created
  createdAt?: Timestamp;          // Creation timestamp
  updatedAt?: Timestamp;          // Last update timestamp
  updatedBy?: string;             // User UID who last updated
}
```

#### `tasks`
```typescript
{
  id: string;                     // Firestore document ID
  locationId: string;             // Reference to location (renamed from propertyId)
  name: string;                   // Task name
  description?: string;           // Task description
  status: "scheduled" | "in_progress" | "completed";
  assigned_to: "teleoperator" | "human_cleaner";
  templateId?: string;            // Reference to task template
  partnerOrgId: string;           // Partner organization ID
  assignedToUserId?: string;     // User UID assigned to task
  priority?: "low" | "medium" | "high";
  duration?: number;              // Estimated duration in minutes
  type?: string;                  // Task type
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedBy?: string;
}
```

#### `taskTemplates`
```typescript
{
  id: string;
  name: string;
  description?: string;
  partnerOrgId: string;
  isActive: boolean;
  // ... other template fields
}
```

#### `sessions`
```typescript
{
  id: string;
  locationId: string;             // Reference to location
  operatorId: string;             // User UID of operator
  started_at: Timestamp;
  ended_at?: Timestamp;
  outcome?: string;
  // ... other session fields
}
```

#### `locationNotes` (formerly `propertyNotes`)
```typescript
{
  id: string;
  locationId: string;             // Reference to location
  partnerOrgId: string;
  authorId: string;               // User UID
  authorEmail: string;
  content: string;
  createdAt: string;               // ISO string
}
```

### Important Database Configuration

**CRITICAL**: The Firestore database is configured as:
- **Mode**: Native mode (not Datastore mode)
- **Location**: `nam5` (multi-region, us-central)
- **Database ID**: `default` (without parentheses) - **This is critical!**

The REST API requires `default` (without parentheses), not `(default)`. The SDK is configured to use `default` as well.

## Authentication & Authorization

### Firebase Authentication

Users authenticate via Firebase Authentication (email/password). Custom claims are used for role-based access:

```typescript
{
  role: "admin" | "operator";
  partner_org_id: string;         // Partner organization ID
}
```

### Security Rules

Firestore security rules enforce:
- **Admin users**: Full read/write access to all collections
- **Operator users**: Read access to their partner organization's data, limited write access (can update task status)
- **Partner matching**: Users can only access data for their `partner_org_id`

Key rule functions:
- `isAdmin()`: Checks if user has `role == "admin"`
- `isOperator()`: Checks if user has `role == "operator"`
- `partnerMatches(partnerOrgId)`: Checks if user's `partner_org_id` matches

### Setting Admin Role

Use the script:
```bash
npm run set-admin -- tony@supervolcano.ai
```

This script:
1. Creates the user if they don't exist
2. Sets a temporary password (`ChangeMe123!`)
3. Sets the `role: "admin"` custom claim
4. User must sign out and sign back in for changes to take effect

## Key Implementation Details

### Data Access Layer

The application uses a repository pattern for data access:

- **`propertiesRepo.ts`**: Handles all location CRUD operations
  - `createProperty()`: Creates new locations (uses REST API fallback if SDK fails)
  - `updateProperty()`: Updates existing locations
  - `watchProperties()`: Real-time listener for location changes
  - **REST API Fallback**: If SDK `setDoc` times out, automatically falls back to REST API

- **`tasksRepo.ts`**: Handles all task CRUD operations
  - `createTask()`, `updateTask()`, `deleteTask()`
  - `watchTasks()`: Real-time listener for task changes

### REST API Fallback Mechanism

**Important**: The `createProperty()` function includes a sophisticated fallback mechanism:

1. **Primary**: Attempts to write via Firestore SDK (`setDoc`)
2. **Fallback**: If SDK times out (>10 seconds), automatically uses REST API
3. **Database ID Discovery**: Tests both `(default)` and `default` formats, caches the working one
4. **Error Handling**: Comprehensive logging and error messages

This was implemented to handle issues with `nam5` multi-region databases where the SDK sometimes times out.

### Custom Hooks

- **`useAuth`**: Manages authentication state, provides user and claims
- **`useProperties`**: Wraps `watchProperties()` with React state management
- **`useCollection`**: Generic hook for any Firestore collection
- **`useDoc`**: Generic hook for a single Firestore document

### Media Management

Media files are stored in Firebase Storage at:
```
locations/{locationId}/media/{mediaId}-{filename}
```

Media metadata is stored in the `locations` document's `media` array.

## Recent Changes & Fixes

### Collection Renaming (Properties → Locations)

The application was refactored to use "locations" instead of "properties":
- Collection: `properties` → `locations`
- Field: `propertyId` → `locationId`
- Collection: `propertyNotes` → `locationNotes`
- Migration script: `scripts/migrate-to-locations.ts`

### Database ID Fix

**Critical Fix**: The Firestore database ID format was corrected:
- **Before**: SDK used `(default)` (with parentheses)
- **After**: Both SDK and REST API use `default` (without parentheses)
- **File**: `src/lib/firebaseClient.ts` - `getFirestore(firebaseApp, "default")`

### REST API Fallback Implementation

Implemented automatic REST API fallback when SDK times out:
- Tests database ID format by reading existing document
- Caches the working database ID format
- Uses POST for new documents, PATCH for updates
- Comprehensive error logging

## Deployment

### Vercel Deployment

1. **Automatic**: Push to `main` branch triggers deployment
2. **Manual**: Can deploy via Vercel dashboard
3. **Environment Variables**: Set in Vercel dashboard
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Rules Deployment

Firestore and Storage rules must be deployed manually via Firebase Console:
1. Go to Firebase Console → Firestore Database → Rules
2. Copy rules from `src/firebase/firestore.rules`
3. Paste and "Publish"

Same process for Storage rules.

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Firestore enabled

### Setup

```bash
npm install
npm run dev
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run set-admin -- <email>`: Set admin role for user
- `npm run list-users`: List all Firebase Auth users
- `npm run check-locations`: Check locations collection

## Known Issues & Considerations

### SDK Timeout Issue

The Firestore SDK sometimes times out when writing to `nam5` multi-region databases. The REST API fallback handles this automatically, but it's worth monitoring.

### Browser Cache

After deployments, users may need to hard refresh (Cmd+Shift+R / Ctrl+Shift+R) to load the latest JavaScript bundle.

### Token Refresh

After setting admin role, users must sign out and sign back in for the new role to take effect (custom claims are cached in the token).

## File Structure Highlights

### Critical Files

- **`src/lib/firebaseClient.ts`**: Firebase initialization - **uses `default` database ID**
- **`src/lib/repositories/propertiesRepo.ts`**: Location CRUD with REST API fallback
- **`src/app/admin/properties/page.tsx`**: Main admin location management UI
- **`src/firebase/firestore.rules`**: Security rules - **must be deployed manually**

### Type Definitions

- **`src/lib/types.ts`**: All TypeScript types (`SVLocation`, `SVTask`, etc.)
- Types use `locationId` (not `propertyId`) after refactoring

## Testing & Debugging

### Console Logging

The application includes extensive console logging:
- `[admin]`: Admin page operations
- `[repo]`: Repository/data layer operations
- `[firebase]`: Firebase SDK operations

### Network Tab

When debugging write issues:
1. Open DevTools → Network tab
2. Filter by "firestore" or "googleapis"
3. Look for POST/PATCH requests to `firestore.googleapis.com`
4. Check response status (200 = success, 403 = permissions, 404 = not found)

### Firebase Console

- Check Firestore Database → Data tab to verify documents exist
- Check Firestore Database → Rules tab to verify rules are deployed
- Check Authentication → Users to verify custom claims

## Support & Contact

- **Support Email**: tony@supervolcano.ai
- **Project**: super-volcano-oem-portal
- **Repository**: GitHub (private)

## Next Steps for New Developers

1. **Read this document** thoroughly
2. **Set up local environment** (npm install, configure Firebase)
3. **Review Firebase Console** to understand data structure
4. **Test admin role** using `npm run set-admin`
5. **Create a test location** to understand the flow
6. **Review security rules** to understand permissions
7. **Check recent commits** for latest changes

## Important Notes

⚠️ **Database ID Format**: Always use `default` (without parentheses) for `nam5` multi-region databases in both SDK and REST API calls.

⚠️ **Security Rules**: Must be deployed manually via Firebase Console - they are not automatically deployed.

⚠️ **Admin Role**: Users must sign out and sign back in after admin role is set for changes to take effect.

⚠️ **REST API Fallback**: The application automatically falls back to REST API if SDK times out - this is expected behavior for `nam5` databases.

---

**Last Updated**: December 2024
**Version**: 1.0
**Status**: Production

