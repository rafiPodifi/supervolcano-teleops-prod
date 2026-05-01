# SuperVolcano OEM Partner Portal

Next.js (App Router) portal for SuperVolcano field workers (OEM teleoperators and property cleaners), managers, and OEM partners. Built with TypeScript, TailwindCSS, and shadcn/ui, backed by Firebase for client and admin workloads.

## Architecture

The application consists of two main portals:

- **Admin Portal** (`/admin`): For SuperVolcano internal team to manage organizations, locations, tasks, and users
- **Organization Portal** (`/org`): For customer organizations (managers and field workers) to view analytics, manage tasks, and track performance

## User Roles

### Platform Administration
- **admin**: SuperVolcano operational admin, full system access
- **superadmin**: SuperVolcano engineering/root access, highest privileges

### B2B: OEM Robotics Testing
- **partner_manager**: OEM company manager, assigns robot tests, manages teleoperators
- **oem_teleoperator**: OEM worker, operates robots remotely at test locations

### B2C: Property Management
- **location_owner**: Property owner/manager, assigns cleaning tasks, manages cleaners
- **location_cleaner**: Cleaning worker, performs cleaning tasks at assigned properties

### Organization Assignment
- Admins belong to `sv:internal` (SuperVolcano organization)
- Partner Managers & OEM Teleoperators belong to OEM partner orgs (`oem:company-slug`)
- Location Owners & Property Cleaners belong to property owner orgs (`owner:owner-slug`)

### Stack

- Next.js 14 (App Router) + TypeScript
- TailwindCSS + shadcn/ui component primitives
- Firebase client SDK (Auth, Firestore, Storage)
- Firebase Admin SDK for privileged API routes
- PostgreSQL (for Robot Intelligence API only)

### Database Architecture

SuperVolcano uses a **dual-database architecture**:

- **Firestore** (Source of Truth): All human-facing endpoints (admin portal, organization portal, mobile apps)
- **PostgreSQL** (Read-Only Replica): Robot-facing endpoints only (`/api/robot/v1/*`)

**Important:** Admin and organization endpoints should ONLY query Firestore. PostgreSQL is reserved for robot API endpoints. See [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) for details.

### Getting Started

1. **Install dependencies**

   ```
   pnpm install
   ```

   > npm and yarn also work if preferred.

## Environment Variables

Create a `.env.local` file at the project root with the following variables:

### Required Variables

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK (Server-side only)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# SQL Database Connection (for Robot Intelligence sync)
SQL_HOST=your-sql-host.com
SQL_USER=your-sql-user
SQL_PASSWORD=your-sql-password
SQL_DATABASE=supervolcano_production

# Cron Secret (generate with: openssl rand -base64 32)
CRON_SECRET=your-super-secret-cron-key-here

# Google Drive API (Optional - for Data Intelligence Drive sync)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**⚠️ Security Note**: Never commit `.env.local` to version control. The admin private key should retain literal `\n` characters. When copying from a JSON service account, surround the value with quotes and keep `\n` escapes.

### Optional: Google Drive Sync

To enable Google Drive folder sync in the Data Intelligence dashboard, see [GOOGLE_DRIVE_SETUP.md](./GOOGLE_DRIVE_SETUP.md) for detailed setup instructions.

## Project Structure

```
supervolcano-teleoperator-portal/
├── src/
│   ├── app/
│   │   ├── admin/          # Admin portal routes
│   │   ├── org/            # Organization portal routes
│   │   ├── api/            # API routes
│   │   └── login/          # Authentication
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   ├── org/            # Organization portal components
│   │   └── admin/          # Admin portal components
│   ├── lib/
│   │   ├── repositories/   # Data access layer
│   │   ├── validation/     # Zod schemas
│   │   └── utils/          # Utility functions
│   └── hooks/              # React hooks
├── scripts/                # Utility scripts
├── firebase/               # Firebase configuration
└── TESTING_CHECKLIST.md    # Testing guide
└── SECURITY_AUDIT.md       # Security checklist
```

## Firebase Configuration

### 1. Enable Services

- **Authentication**: Email/Password provider
- **Firestore**: Native mode database
- **Storage**: Default bucket (for images/videos)

### 2. Deploy Security Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules --project your-project-id

# Deploy Storage rules (if using)
firebase deploy --only storage:rules --project your-project-id
```

- Firestore rules: `src/firebase/firestore.rules`
  - Role-based access control using explicit roles: `admin`, `superadmin`, `partner_manager`, `location_owner`, `oem_teleoperator`, `location_cleaner`
  - Organization-based data isolation
  - Field worker permissions for task completion and session management
- Storage rules: `src/firebase/storage.rules`

### 3. Create Firestore Indexes

Some queries require composite indexes. When you see an index error, follow the link in the error message to create the index in Firebase Console, or add it to `firestore.indexes.json` and deploy:

```bash
firebase deploy --only firestore:indexes --project your-project-id
```

## Testing

See `TESTING_CHECKLIST.md` for comprehensive testing procedures.

### Quick Test

1. Create an organization via admin portal
2. Log in as the created manager (partner_manager or location_owner)
3. View dashboard and locations
4. Create a field worker (oem_teleoperator or property_cleaner)
5. Log in as the field worker
6. Complete a task
7. Verify completion appears in manager dashboard

## Security

See `SECURITY_AUDIT.md` for security checklist and best practices.

### Key Security Features

- Role-based access control (RBAC)
- Organization data isolation
- Firestore security rules
- Input validation with Zod
- Secure authentication tokens
- Environment variable protection

## Key Features

### Admin Portal (`/admin`)
- **Organizations**: Create and manage customer organizations with primary managers
- **Locations**: Create locations, assign to organizations, manage tasks and instructions
- **Tasks**: Create tasks with detailed instructions (text, images, videos)
- **Team Management**: Add managers (partner_manager, location_owner) and field workers (oem_teleoperator, property_cleaner) to organizations
- **Analytics**: View organization performance metrics

### Organization Portal (`/org`)
- **Dashboard**: Role-based views (analytics for managers, task-focused for field workers)
- **Locations**: View assigned locations with tasks and instructions
- **Task Completion**: Field workers (oem_teleoperator, location_cleaner) can complete tasks with detailed tracking
- **Session Tracking**: Automatic session creation based on task completions
- **Performance Analytics**: Track completions, durations, and team performance
- **Team View**: Managers can view all team members and their stats

### Task Management
- **Recurring Tasks**: Tasks can be completed multiple times
- **Completion History**: View all completions for a task with details
- **Session-Based**: Completions automatically grouped into daily sessions
- **Rich Instructions**: Support for images, videos, and step-by-step guidance

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in on `/login`.

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Create Test Users

```bash
# Create an organization manager
npm run create:org-manager <email> <password> [organizationId]

# Assign manager to existing organization
npm run assign:manager "<org name>" <email> <password>

# Create a teleoperator
npm run create:teleoperator <email> <password> <organizationId>

# Reset teleoperator password
npm run reset:password <email>
```

## Deployment

### Vercel (Recommended)

1. Push repository to GitHub/GitLab
2. Import project into Vercel
3. Set environment variables in Vercel → Settings → Environment Variables
4. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Vercel (recommended)
- Netlify
- AWS Amplify
- Railway
- Self-hosted with Node.js

## Performance Optimizations

- **Memoization**: Expensive computations cached with `useMemo`
- **Lazy Loading**: Images load on demand
- **Skeleton Loaders**: Better perceived performance
- **Debouncing**: Search inputs debounced (if added)
- **Code Splitting**: Automatic with Next.js App Router

## Troubleshooting

### Common Issues

**Build Errors**
- Check TypeScript errors: `npm run build`
- Verify all imports are correct
- Ensure environment variables are set

**Authentication Issues**
- Verify Firebase Auth is enabled
- Check custom claims are set correctly
- Ensure user has required role

**Permission Denied Errors**
- Verify Firestore rules are deployed
- Check user's organizationId matches data
- Review security rules in Firebase Console

**Missing Indexes**
- Follow error message link to create index
- Or add to `firestore.indexes.json` and deploy

## Contributing

1. Create feature branch
2. Make changes
3. Run tests: `npm run build`
4. Update documentation
5. Submit pull request

## License

Proprietary - SuperVolcano OEM Partner Portal