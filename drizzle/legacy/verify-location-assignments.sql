-- Verification queries for location_assignments table
-- Run these one at a time in Neon SQL Editor

-- Query 1: Check if table exists and see all columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'location_assignments'
ORDER BY ordinal_position;

-- Query 2: Check if indexes exist
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'location_assignments';

-- Query 3: Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'location_assignments';

-- Query 4: Count current assignments (should be 0 initially)
SELECT COUNT(*) as total_assignments FROM location_assignments;

-- Query 5: Check if unique constraint exists
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'location_assignments';

