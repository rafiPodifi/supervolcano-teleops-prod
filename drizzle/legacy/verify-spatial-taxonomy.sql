-- =============================================================================
-- VERIFICATION SCRIPT - Spatial Taxonomy System
-- =============================================================================
-- Run this after create-spatial-taxonomy.sql to verify everything was created correctly

-- =============================================================================
-- PART 1: Verify Tables Exist
-- =============================================================================

SELECT 
  'Tables Check' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ All tables exist'
    ELSE '❌ Missing tables'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'room_types',
    'target_types',
    'action_types',
    'location_floors',
    'location_rooms',
    'location_targets',
    'target_actions'
  );

-- =============================================================================
-- PART 2: Verify Sample Data Loaded
-- =============================================================================

-- Room Types (should be 10)
SELECT 
  'Room Types' as table_name,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 10 THEN '✅ Correct count'
    ELSE '❌ Expected 10, got ' || COUNT(*)::text
  END as status
FROM room_types;

-- Target Types (should be 16)
SELECT 
  'Target Types' as table_name,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 16 THEN '✅ Correct count'
    ELSE '❌ Expected 16, got ' || COUNT(*)::text
  END as status
FROM target_types;

-- Action Types (should be 17)
SELECT 
  'Action Types' as table_name,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 17 THEN '✅ Correct count'
    ELSE '❌ Expected 17, got ' || COUNT(*)::text
  END as status
FROM action_types;

-- =============================================================================
-- PART 3: View Sample Data
-- =============================================================================

-- View Room Types
SELECT 
  name,
  icon,
  color,
  sort_order,
  is_active
FROM room_types
ORDER BY sort_order;

-- View Target Types
SELECT 
  name,
  icon,
  is_active
FROM target_types
ORDER BY name;

-- View Action Types
SELECT 
  name,
  estimated_duration_minutes,
  is_active
FROM action_types
ORDER BY name;

-- =============================================================================
-- PART 4: Verify Indexes
-- =============================================================================

SELECT 
  'Indexes Check' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) >= 5 THEN '✅ Indexes created'
    ELSE '❌ Missing indexes'
  END as status
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
  AND tablename IN (
    'location_floors',
    'location_rooms',
    'location_targets',
    'target_actions'
  );

-- List all indexes
SELECT 
  tablename,
  indexname
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =============================================================================
-- PART 5: Verify Triggers
-- =============================================================================

SELECT 
  'Triggers Check' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ All triggers exist'
    ELSE '❌ Missing triggers'
  END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.tgname LIKE '%updated_at%'
  AND c.relname IN (
    'room_types',
    'target_types',
    'action_types',
    'location_floors',
    'location_rooms',
    'location_targets',
    'target_actions'
  );

-- List all triggers
SELECT 
  c.relname as table_name,
  t.tgname as trigger_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.tgname LIKE '%updated_at%'
ORDER BY c.relname, t.tgname;

-- =============================================================================
-- PART 6: Verify Foreign Key Constraints
-- =============================================================================

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'location_rooms',
    'location_targets',
    'target_actions'
  )
ORDER BY tc.table_name, kcu.column_name;

-- =============================================================================
-- PART 7: Test Data Integrity
-- =============================================================================

-- Test: Can we insert a floor?
-- (This will fail if there's a constraint issue)
DO $$
DECLARE
  test_floor_id UUID;
BEGIN
  INSERT INTO location_floors (location_id, name, sort_order)
  VALUES ('test-location-id', 'Test Floor', 0)
  RETURNING id INTO test_floor_id;
  
  -- Clean up
  DELETE FROM location_floors WHERE id = test_floor_id;
  
  RAISE NOTICE '✅ Floor insertion test passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Floor insertion test failed: %', SQLERRM;
END $$;

-- Test: Can we insert a room?
DO $$
DECLARE
  test_room_id UUID;
  test_room_type_id UUID;
BEGIN
  -- Get a room type
  SELECT id INTO test_room_type_id FROM room_types LIMIT 1;
  
  INSERT INTO location_rooms (location_id, room_type_id, sort_order)
  VALUES ('test-location-id', test_room_type_id, 0)
  RETURNING id INTO test_room_id;
  
  -- Clean up
  DELETE FROM location_rooms WHERE id = test_room_id;
  
  RAISE NOTICE '✅ Room insertion test passed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Room insertion test failed: %', SQLERRM;
END $$;

-- =============================================================================
-- PART 8: Summary Report
-- =============================================================================

SELECT 
  '=== VERIFICATION SUMMARY ===' as summary;

SELECT 
  'Tables' as category,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('room_types', 'target_types', 'action_types', 
                      'location_floors', 'location_rooms', 'location_targets', 'target_actions')) as count,
  'Expected: 7' as expected;

SELECT 
  'Room Types' as category,
  COUNT(*) as count,
  'Expected: 10' as expected
FROM room_types;

SELECT 
  'Target Types' as category,
  COUNT(*) as count,
  'Expected: 16' as expected
FROM target_types;

SELECT 
  'Action Types' as category,
  COUNT(*) as count,
  'Expected: 17' as expected
FROM action_types;

SELECT 
  'Indexes' as category,
  COUNT(*) as count,
  'Expected: 5+' as expected
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
  AND tablename IN ('location_floors', 'location_rooms', 'location_targets', 'target_actions');

SELECT 
  'Triggers' as category,
  COUNT(*) as count,
  'Expected: 7' as expected
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.tgname LIKE '%updated_at%'
  AND c.relname IN ('room_types', 'target_types', 'action_types', 
                    'location_floors', 'location_rooms', 'location_targets', 'target_actions');

