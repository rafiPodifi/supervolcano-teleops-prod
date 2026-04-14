# SuperVolcano Database Schema

## Collections

### organizations
Stores all organizations (OEM partners and location owners)

```typescript
{
  id: string;                    // Prefixed: 'oem:figure-ai', 'owner:johns-properties', 'sv:internal'
  name: string;                  // Human-readable: 'Figure AI', 'John's Property Management'
  type: 'supervolcano' | 'oem_partner' | 'location_owner';
  slug: string;                  // URL-friendly: 'figure-ai', 'johns-properties'
  contactEmail?: string;
  contactPhone?: string;
  billingStatus?: 'active' | 'suspended' | 'trial';
  metadata?: Record<string, any>;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### locations
Physical locations where work happens

```typescript
{
  id: string;
  address: string;
  
  // Ownership model
  ownedBy: string;               // organizationId of owner ('sv:internal' or 'owner:johns-properties')
  ownerType: 'supervolcano' | 'location_owner';
  
  // Assignment model (multiple orgs can have workers at same location)
  assignedOrganizations: string[]; // Array of organizationIds with access
  
  // Legacy support (will be phased out)
  organizationId?: string;       // Single org assignment (legacy)
  
  // Location type
  type: 'test_site' | 'property';
  
  // Metadata
  metadata?: {
    rooms?: number;
    sqft?: number;
    coordinates?: { lat: number; lng: number; };
  };
  
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### users
All platform users

```typescript
{
  uid: string;
  email: string;
  displayName?: string;
  
  role: 'admin' | 'superadmin' | 'partner_manager' | 'location_owner' | 'oem_teleoperator' | 'location_cleaner';
  
  organizationId: string;        // Which org they belong to
  
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### robot_intelligence
Synced from SQL database (read-only from Firebase perspective)

```typescript
{
  id: string;
  
  // Task data
  taskId: string;
  locationId: string;
  userId: string;
  organizationId: string;
  
  // Performance metrics
  completionTime: number;
  accuracy: number;
  errors: number;
  
  // Training data
  videoUrl?: string;
  annotations?: any;
  
  // Sync metadata
  sqlId: number;                 // Original SQL record ID
  syncedAt: Timestamp;
  
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### _sync_metadata
Tracks sync status for SQL → Firebase sync

```typescript
{
  id: string;                    // Collection name (e.g., 'robot_intelligence')
  lastSyncAt: Timestamp;
  recordsSynced: number;
  errors: number;
  syncedAt: Timestamp;
}
```

### assignments
User-to-location assignments (legacy, will be phased out in favor of organization-level assignments)

```typescript
{
  id: string;
  user_id: string;
  location_id: string;
  assigned_by: string;
  assigned_at: Timestamp;
  status: 'active' | 'inactive';
  role: 'oem_teleoperator' | 'location_cleaner' | 'location_owner' | 'partner_manager';
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

## Organization Model

**OEM Partners (B2B):**
- Robotics companies (Figure AI, Tesla, etc.)
- Have partner managers and OEM teleoperators
- Assigned to test sites owned by SuperVolcano
- Access robot intelligence data via API

**Location Owners (B2C):**
- Property managers/owners
- Have location cleaners
- Own and manage their properties
- Can assign cleaners to their locations

**Multi-org Locations:**
- SuperVolcano owns test sites
- Can assign multiple OEM partners to same test site
- Each OEM's workers only see their assigned locations

## SQL Sync

Robot intelligence data flows from SQL → Firebase:

- Cron job runs every 5 minutes
- Syncs new/updated records
- OEM partners read from Firebase via API
- Never writes back to SQL from Firebase

