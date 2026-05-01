# Structured Task Taxonomy System

## Overview

The SuperVolcano Task Taxonomy provides a structured vocabulary for robot tasks, enabling precise queries, analytics, and composable task templates. This is a **competitive moat** that enables robots to query tasks like: "Show me all 'wipe' actions on 'counter' surfaces in 'kitchen' rooms across all locations."

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  TAXONOMY SYSTEM                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Core Taxonomy (/lib/taxonomy.ts)                │
│     - Floors, rooms, targets, actions, modifiers    │
│     - Helper functions for generation/validation   │
│     - Type-safe constants                           │
│                                                      │
│  2. Database Schema (additive, backwards compatible)│
│     - structure_* fields (optional)                 │
│     - Indexes for fast querying                     │
│                                                      │
│  3. API Endpoint (/api/taxonomy)                    │
│     - Public documentation for robot OEMs           │
│     - Versioned, stable contract                    │
│                                                      │
│  4. UI Components (coming in Prompt 29)             │
│     - Smart dropdowns with context                  │
│     - Auto-generated titles                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Design Principles

- **Optional structured fields** coexist with legacy free-text
- **Backwards compatible** - existing tasks continue working
- **Progressive enhancement** - migrate gradually
- **Context-aware** - room-specific targets prevent invalid combinations

## Setup

### 1. Run Database Migration

Execute the SQL migration in Neon Console:

```sql
-- File: database/migrations/add-structure-fields.sql
-- This adds optional structure columns to the jobs table
```

**Steps:**
1. Go to Neon Console → SQL Editor
2. Copy contents of `database/migrations/add-structure-fields.sql`
3. Execute the script
4. Verify columns were created:
   ```sql
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'jobs' 
     AND column_name LIKE 'structure_%';
   ```

### 2. Test Taxonomy API

After deployment, test the public API:

```bash
curl https://supervolcano-teleops.vercel.app/api/taxonomy | jq .
```

Expected response includes:
- Complete taxonomy vocabulary
- Human-readable labels
- Usage examples
- Documentation

## Usage Examples

### Generate Task Title from Structure

```typescript
import { generateTaskTitle } from '@/lib/taxonomy';

const structure = {
  floor: 'first_floor',
  room: 'bathroom',
  target: 'mirror',
  action: 'clean',
  roomModifier: 'primary',
};

const title = generateTaskTitle(structure);
// Returns: "Clean 1st Floor Primary Bathroom Mirror"
```

### Validate Task Structure

```typescript
import { validateTaskStructure } from '@/lib/taxonomy';

const validation = validateTaskStructure(structure);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

### Get Context-Aware Targets

```typescript
import { getTargetsForRoom } from '@/lib/taxonomy';

const kitchenTargets = getTargetsForRoom('kitchen');
// Returns: ['counter', 'sink', 'stove', 'oven', ...]
```

### Parse Legacy Task Title

```typescript
import { parseTaskTitle } from '@/lib/taxonomy';

const parsed = parseTaskTitle("Wipe Second Floor Kitchen Counter");
// Returns: { floor: "second_floor", room: "kitchen", target: "counter", action: "wipe" }
```

## API Endpoint

### GET /api/taxonomy

Public endpoint for robot OEMs and external integrations.

**Response:**
```json
{
  "success": true,
  "version": "1.0.0",
  "taxonomy": {
    "floors": [...],
    "rooms": [...],
    "targets": {...},
    "actions": [...],
    "roomModifiers": [...]
  },
  "labels": {...},
  "documentation": {
    "structure": {...},
    "examples": [...],
    "usage": {...}
  }
}
```

**Caching:** Responses are cached for 1 hour (`Cache-Control: public, max-age=3600`)

## Database Schema

### New Columns (Optional)

- `structure_floor` VARCHAR(50) - Floor level
- `structure_room` VARCHAR(50) - Room type
- `structure_target` VARCHAR(50) - Specific target object
- `structure_action` VARCHAR(50) - Action verb
- `structure_room_modifier` VARCHAR(50) - Room qualifier

### Indexes

- `idx_jobs_structure_room` - Fast queries by room
- `idx_jobs_structure_action` - Fast queries by action
- `idx_jobs_structure_floor` - Fast queries by floor
- `idx_jobs_structure_composite` - Composite index for common query patterns

## Type Definitions

### TaskStructure

```typescript
interface TaskStructure {
  floor: string;           // Required
  room: string;            // Required
  target?: string;         // Optional
  action: string;          // Required
  roomModifier?: string;   // Optional
}
```

### Task (Updated)

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  structure?: TaskStructure;  // NEW: Optional structured fields
  // ... existing fields
}
```

## Taxonomy Vocabulary

### Floors
- `basement`, `first_floor`, `second_floor`, `third_floor`, `attic`

### Rooms
- `kitchen`, `bathroom`, `bedroom`, `living_room`, `dining_room`, `office`, `hallway`, `garage`, `laundry_room`, `entryway`, `closet`, `pantry`, `mudroom`

### Actions
- `clean`, `wipe`, `sweep`, `mop`, `vacuum`, `dust`, `organize`, `sanitize`, `polish`, `scrub`, `empty`, `refill`, `straighten`, `fold`

### Room Modifiers
- `primary`, `guest`, `main`, `half`, `kids`, `upstairs`, `downstairs`

### Targets (Room-Specific)
Targets are context-aware and vary by room. For example:
- **Kitchen**: `counter`, `sink`, `stove`, `oven`, `refrigerator`, etc.
- **Bathroom**: `sink`, `mirror`, `toilet`, `shower`, `bathtub`, etc.

See `/lib/taxonomy.ts` for complete list.

## Next Steps

1. **Run SQL Migration** - Execute `database/migrations/add-structure-fields.sql` in Neon Console
2. **Test API** - Verify `/api/taxonomy` returns correct data
3. **Build UI Components** (Prompt 29) - Create structured dropdowns with context-aware filtering
4. **Migrate Existing Tasks** (Optional) - Use `parseTaskTitle()` to extract structure from legacy tasks

## Key Design Decisions

**Why optional structure fields?**
- Backwards compatibility with existing free-text tasks
- Progressive enhancement - migrate gradually
- Legacy tasks continue working without modification

**Why room-specific targets?**
- Context-aware UI: show only relevant options
- Prevents invalid combinations (e.g., "toilet" in "kitchen")
- Better UX and data quality

**Why "primary" instead of "master"?**
- Modern, inclusive terminology
- Industry standard shift (real estate, hospitality)
- More accurate (can have multiple special rooms)

## Success Criteria

✅ Taxonomy API returns 200 with valid JSON
✅ Helper functions generate correct titles
✅ Validation catches invalid structures
✅ Database columns exist with proper indexes
✅ TypeScript types enforce structure throughout
✅ No breaking changes to existing tasks

## Support

For questions or issues:
- API Documentation: `/api/taxonomy`
- Code: `/lib/taxonomy.ts`
- Types: `/types/task.ts`



