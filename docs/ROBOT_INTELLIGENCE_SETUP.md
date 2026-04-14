# Robot Intelligence Database - Setup Guide

This document describes the PostgreSQL-based robot intelligence layer that syncs data from Firestore and provides queryable endpoints for robots.

## Architecture

```
┌─────────────────────────────────┐
│   Teleop Portal (Firestore)     │ ← Unchanged, all existing functionality
│   - Locations                    │
│   - Sessions                     │
│   - Tasks                        │
│   - Task Completions             │
│   - Organizations                │
│   - Users                        │
└────────────┬────────────────────┘
             │
             │ Sync via API (one-way, read-only)
             ▼
┌─────────────────────────────────┐
│   Robot Intelligence (SQL)      │ ← New, robot-only
│   - locations                    │
│   - shifts (synced from sessions)│
│   - tasks                        │
│   - moments (new)                │
│   - media (new)                  │
│   - location_preferences (new)   │
└────────────┬────────────────────┘
             │
             │ Query via API
             ▼
┌─────────────────────────────────┐
│      Robot Clients               │
│   - Query by location/task       │
│   - Get visual instructions      │
│   - Report execution results     │
└─────────────────────────────────┘
```

**Key Principle**: Firestore → SQL sync is one-way. Robots never touch Firestore.

## Setup Steps

### 1. Set Up Vercel Postgres Database

1. Go to Vercel Dashboard → Your Project → Storage
2. Click "Create" → "Postgres Database"
3. Choose a name (e.g., "robot-intelligence")
4. Select a region
5. Click "Create"

### 2. Get Connection Strings

After creating the database, Vercel will provide three connection strings:

- `POSTGRES_URL` - Pooled connection (for serverless)
- `POSTGRES_PRISMA_URL` - Prisma-compatible connection
- `POSTGRES_URL_NON_POOLING` - Direct connection (for migrations)

### 3. Add Environment Variables

Add these to your `.env.local` file and Vercel project settings:

```bash
# Postgres Connection (from Vercel)
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."

# Robot API Key (generate a secure random string)
ROBOT_API_KEY="your_secure_random_key_here"
```

**Generate a secure API key:**
```bash
# Using openssl
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Database Schema

Connect to your Postgres database and run the schema:

**Option A: Using Vercel CLI**
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Connect to database
vercel postgres connect

# Run schema
psql < database/schema.sql
```

**Option B: Using Database Tool**
1. Get connection string from Vercel
2. Connect using pgAdmin, DBeaver, or similar tool
3. Run `database/schema.sql`

**Option C: Using Node.js Script**
```bash
# Create a script to run the schema
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING });
client.connect().then(() => {
  const schema = fs.readFileSync('database/schema.sql', 'utf8');
  return client.query(schema);
}).then(() => {
  console.log('Schema applied successfully');
  client.end();
}).catch(err => {
  console.error('Error:', err);
  client.end();
});
"
```

### 5. Initial Data Sync

Once the database is set up:

1. **Via Admin Interface:**
   - Log in as admin
   - Navigate to `/admin/robot-intelligence`
   - Click "Sync from Firestore" button

2. **Via API:**
   ```bash
   curl -X POST https://your-app.vercel.app/api/admin/sync \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## API Endpoints

### Robot Query API

**Endpoint**: `POST /api/robot/v1/query`

**Authentication**: `x-api-key` header (must match `ROBOT_API_KEY`)

**Request Body**:
```json
{
  "locationId": "abc123",
  "taskTitle": "clean kitchen",
  "actionVerb": "wipe",
  "momentType": "action",
  "roomLocation": "kitchen",
  "keywords": ["counter", "surface"],
  "tags": ["cleaning"],
  "humanVerifiedOnly": true,
  "limit": 50
}
```

**Response**:
```json
{
  "query": { ... },
  "results": {
    "count": 5,
    "moments": [
      {
        "id": "uuid",
        "action": {
          "verb": "wipe",
          "target": "counter",
          "description": "Wipe all counter surfaces"
        },
        "location": { ... },
        "task": { ... },
        "timing": { ... },
        "media": [ ... ],
        "preference": { ... },
        "quality": { ... }
      }
    ]
  }
}
```

### Robot Feedback API

**Endpoint**: `POST /api/robot/v1/feedback`

**Authentication**: `x-api-key` header

**Request Body**:
```json
{
  "momentId": "uuid",
  "robotId": "robot-001",
  "locationId": "abc123",
  "success": true,
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T10:05:00Z",
  "durationSeconds": 300,
  "errorMessage": null,
  "notes": "Completed successfully",
  "robotType": "fetch",
  "softwareVersion": "1.2.3"
}
```

## Database Schema Overview

### Synced Tables (from Firestore)

- **locations**: Synced from Firestore locations
- **shifts**: Synced from Firestore sessions
- **tasks**: Synced from Firestore tasks (in location subcollections)

### New Tables (Robot Intelligence)

- **moments**: Atomic units of robot-executable work
- **media**: Videos, images, annotations linked to moments
- **moment_media**: Junction table (many-to-many)
- **location_preferences**: Custom instructions for specific locations
- **robot_executions**: Execution logs from robots

### Views

- **moments_enriched**: Moments with media counts and location info
- **task_performance**: Task completion rates by location

## Sync Service

The sync service (`/lib/services/sync/firestoreToSql.ts`) provides:

- `syncLocation(locationId)`: Sync a single location
- `syncShift(sessionId)`: Sync a single shift (session)
- `syncTask(locationId, taskId)`: Sync a single task
- `syncAllData()`: Batch sync all data

**Note**: Tasks are stored in location subcollections in Firestore, so the sync service handles this structure.

## Admin Interface

Access the robot intelligence admin interface at `/admin/robot-intelligence`:

- View sync statistics
- Trigger manual syncs
- Monitor database health
- (Coming soon) Create moments, upload media, manage preferences

## Testing

### Test Robot Query API

```bash
# Set your API key
export API_KEY="your_robot_api_key"

# Query moments
curl -X POST http://localhost:3000/api/robot/v1/query \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test-location-id",
    "humanVerifiedOnly": true,
    "limit": 10
  }'
```

### Test Robot Feedback API

```bash
curl -X POST http://localhost:3000/api/robot/v1/feedback \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "momentId": "test-moment-uuid",
    "robotId": "test-robot-001",
    "locationId": "test-location-id",
    "success": true,
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:05:00Z",
    "durationSeconds": 300
  }'
```

## Troubleshooting

### Database Connection Issues

- Verify `POSTGRES_URL` is set correctly
- Check Vercel dashboard for database status
- Ensure database is in the same region as your app

### Sync Failures

- Check Firestore permissions
- Verify location/task IDs exist
- Review server logs for specific errors

### API Authentication

- Ensure `ROBOT_API_KEY` matches in both `.env.local` and Vercel
- Check `x-api-key` header is included in requests
- Verify header value matches exactly

## Next Steps

1. **Create Moments**: Build UI to create moments from task instructions
2. **Video AI Processing**: Integrate video processing to extract moments
3. **Media Management**: Add UI for uploading and linking media to moments
4. **Analytics Dashboard**: Build analytics views for robot performance
5. **Location Preferences**: Add UI for managing location-specific customizations

## Security Notes

- Robot API uses API key authentication (not user tokens)
- Admin sync endpoints require admin role
- Database is read-only for robots (write only via feedback API)
- All robot data is separate from teleop portal data

---

**Last Updated**: 2024

