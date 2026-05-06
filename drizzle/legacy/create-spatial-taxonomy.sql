-- =============================================================================
-- SPATIAL TAXONOMY SYSTEM - Complete Schema
-- =============================================================================
-- This replaces the old category/template system with a spatial hierarchy
-- that models physical locations as: Floors → Rooms → Targets → Actions

-- =============================================================================
-- PART 1: BASE LIBRARY (Reusable types that admins can expand)
-- =============================================================================

-- Room Types (Kitchen, Bedroom, Bathroom, etc.)
CREATE TABLE IF NOT EXISTS room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),                    -- lucide-react icon name
  color VARCHAR(20),                    -- hex color for UI
  default_targets JSONB,               -- Suggested target types for this room
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Target Types (Sink, Counter, Window, Mirror, etc.)
CREATE TABLE IF NOT EXISTS target_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  default_actions JSONB,               -- Suggested action types for this target
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Action Types (Wipe, Spray, Scrub, Fold, etc.)
CREATE TABLE IF NOT EXISTS action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  estimated_duration_minutes INTEGER DEFAULT 5,
  tools_required JSONB,                -- ["Microfiber cloth", "Spray bottle"]
  instructions TEXT,                   -- Default instructions
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PART 2: LOCATION STRUCTURE (Per house)
-- =============================================================================

-- Floors (optional - some locations may not use floors)
CREATE TABLE IF NOT EXISTS location_floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) NOT NULL,   -- Foreign key to Firestore locations
  name VARCHAR(255) NOT NULL,          -- "1st Floor", "2nd Floor", "Basement"
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(location_id, name)
);

-- Rooms (instances of room types)
CREATE TABLE IF NOT EXISTS location_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) NOT NULL,
  floor_id UUID REFERENCES location_floors(id) ON DELETE SET NULL,
  room_type_id UUID REFERENCES room_types(id) ON DELETE SET NULL,
  
  custom_name VARCHAR(255),            -- "Primary Bedroom" (overrides room_type.name)
  notes TEXT,                          -- Location-specific notes
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Targets (instances of target types within rooms)
CREATE TABLE IF NOT EXISTS location_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES location_rooms(id) ON DELETE CASCADE,
  target_type_id UUID REFERENCES target_types(id) ON DELETE SET NULL,
  
  custom_name VARCHAR(255),            -- Optional override
  notes TEXT,                          -- "Granite countertop, use granite-safe cleaner"
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Actions (instances of action types on targets)
CREATE TABLE IF NOT EXISTS target_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES location_targets(id) ON DELETE CASCADE,
  action_type_id UUID NOT NULL REFERENCES action_types(id) ON DELETE CASCADE,
  
  custom_instructions TEXT,            -- Location-specific override
  custom_duration_minutes INTEGER,     -- Override default duration
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PART 3: INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_location_floors_location ON location_floors(location_id);
CREATE INDEX IF NOT EXISTS idx_location_rooms_location ON location_rooms(location_id);
CREATE INDEX IF NOT EXISTS idx_location_rooms_floor ON location_rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_location_targets_room ON location_targets(room_id);
CREATE INDEX IF NOT EXISTS idx_target_actions_target ON target_actions(target_id);

-- =============================================================================
-- PART 4: TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_spatial_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_types_updated_at BEFORE UPDATE ON room_types FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER target_types_updated_at BEFORE UPDATE ON target_types FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER action_types_updated_at BEFORE UPDATE ON action_types FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER location_floors_updated_at BEFORE UPDATE ON location_floors FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER location_rooms_updated_at BEFORE UPDATE ON location_rooms FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER location_targets_updated_at BEFORE UPDATE ON location_targets FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();
CREATE TRIGGER target_actions_updated_at BEFORE UPDATE ON target_actions FOR EACH ROW EXECUTE FUNCTION update_spatial_updated_at();

-- =============================================================================
-- PART 5: SAMPLE DATA - BASE LIBRARY
-- =============================================================================

-- Room Types
INSERT INTO room_types (name, description, icon, color, sort_order, default_targets) VALUES
  ('Kitchen', 'Kitchen and cooking area', 'ChefHat', '#3B82F6', 1, '["Counter", "Sink", "Floor", "Appliances", "Cabinet"]'::jsonb),
  ('Bedroom', 'Bedroom or sleeping area', 'Bed', '#8B5CF6', 2, '["Bed", "Floor", "Window", "Furniture"]'::jsonb),
  ('Bathroom', 'Bathroom', 'Bath', '#EC4899', 3, '["Sink", "Mirror", "Shower", "Toilet", "Floor"]'::jsonb),
  ('Living Room', 'Living room or family room', 'Sofa', '#10B981', 4, '["Floor", "Furniture", "Window"]'::jsonb),
  ('Dining Room', 'Dining area', 'Utensils', '#F59E0B', 5, '["Table", "Floor", "Window"]'::jsonb),
  ('Laundry Room', 'Laundry and utility', 'Shirt', '#6366F1', 6, '["Floor", "Appliances", "Counter"]'::jsonb),
  ('Office', 'Home office or study', 'Laptop', '#14B8A6', 7, '["Desk", "Floor", "Window"]'::jsonb),
  ('Closet', 'Closet or storage', 'Box', '#F97316', 8, '["Floor", "Shelves"]'::jsonb),
  ('Garage', 'Garage', 'Car', '#64748B', 9, '["Floor"]'::jsonb),
  ('Outdoor', 'Outdoor spaces', 'Trees', '#84CC16', 10, '["Patio", "Deck", "Yard"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Target Types
INSERT INTO target_types (name, description, icon, default_actions) VALUES
  ('Counter', 'Countertops and surfaces', 'Square', '["Wipe", "Spray", "Declutter"]'::jsonb),
  ('Sink', 'Sinks and basins', 'Droplet', '["Scrub", "Rinse", "Wipe"]'::jsonb),
  ('Floor', 'Floors and flooring', 'Grid', '["Sweep", "Mop", "Vacuum"]'::jsonb),
  ('Window', 'Windows and glass', 'Square', '["Spray", "Wipe"]'::jsonb),
  ('Mirror', 'Mirrors', 'Circle', '["Spray", "Wipe"]'::jsonb),
  ('Bed', 'Beds', 'Bed', '["Make Bed", "Change Sheets"]'::jsonb),
  ('Shower', 'Shower or tub', 'Shower', '["Scrub", "Rinse", "Spray"]'::jsonb),
  ('Toilet', 'Toilet', 'Circle', '["Scrub", "Spray", "Wipe"]'::jsonb),
  ('Furniture', 'Tables, chairs, sofas', 'Armchair', '["Dust", "Wipe", "Vacuum"]'::jsonb),
  ('Appliances', 'Kitchen appliances', 'Microwave', '["Wipe", "Clean"]'::jsonb),
  ('Cabinet', 'Cabinets and drawers', 'Box', '["Wipe", "Organize"]'::jsonb),
  ('Desk', 'Desks and work surfaces', 'SquareDashed', '["Wipe", "Organize", "Dust"]'::jsonb),
  ('Shelves', 'Shelving units', 'LayoutList', '["Dust", "Organize"]'::jsonb),
  ('Table', 'Dining or coffee tables', 'Grid3x3', '["Wipe", "Polish"]'::jsonb),
  ('Patio', 'Patio or deck', 'Home', '["Sweep", "Clean"]'::jsonb),
  ('Yard', 'Yard or lawn', 'Trees', '["Mow", "Trim"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Action Types
INSERT INTO action_types (name, description, estimated_duration_minutes, tools_required, instructions) VALUES
  ('Wipe', 'Wipe down surfaces', 3, '["Microfiber cloth", "All-purpose cleaner"]'::jsonb, 'Spray cleaner and wipe with microfiber cloth'),
  ('Spray', 'Spray cleaning solution', 2, '["Spray bottle", "Cleaning solution"]'::jsonb, 'Spray evenly across surface'),
  ('Scrub', 'Scrub to remove dirt', 5, '["Scrub brush", "Cleaning solution"]'::jsonb, 'Apply pressure and scrub in circular motions'),
  ('Rinse', 'Rinse with water', 2, '["Water"]'::jsonb, 'Rinse thoroughly with clean water'),
  ('Sweep', 'Sweep floor', 5, '["Broom", "Dustpan"]'::jsonb, 'Sweep debris into dustpan'),
  ('Mop', 'Mop floor', 10, '["Mop", "Bucket", "Floor cleaner"]'::jsonb, 'Mop floor with cleaning solution'),
  ('Vacuum', 'Vacuum carpet or floor', 10, '["Vacuum cleaner"]'::jsonb, 'Vacuum thoroughly in overlapping passes'),
  ('Dust', 'Remove dust', 3, '["Duster", "Microfiber cloth"]'::jsonb, 'Dust all surfaces from top to bottom'),
  ('Polish', 'Polish surfaces', 5, '["Polish", "Soft cloth"]'::jsonb, 'Apply polish and buff to shine'),
  ('Declutter', 'Remove clutter and organize', 5, '[]'::jsonb, 'Remove items that don''t belong, organize remaining items'),
  ('Make Bed', 'Make the bed', 5, '[]'::jsonb, 'Straighten sheets, arrange pillows, smooth comforter'),
  ('Change Sheets', 'Change bed linens', 10, '["Clean sheets"]'::jsonb, 'Remove old sheets, replace with clean ones'),
  ('Organize', 'Organize and tidy', 10, '[]'::jsonb, 'Arrange items neatly and logically'),
  ('Fold', 'Fold laundry', 10, '[]'::jsonb, 'Fold clothes neatly'),
  ('Clean', 'General cleaning', 5, '["Cleaning supplies"]'::jsonb, 'Clean thoroughly'),
  ('Mow', 'Mow lawn', 30, '["Lawn mower"]'::jsonb, 'Mow lawn in straight lines'),
  ('Trim', 'Trim plants or hedges', 15, '["Trimmer", "Shears"]'::jsonb, 'Trim evenly')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE room_types IS 'Base library of room types (Kitchen, Bedroom, etc.)';
COMMENT ON TABLE target_types IS 'Base library of target types (Sink, Counter, etc.)';
COMMENT ON TABLE action_types IS 'Base library of action types (Wipe, Scrub, etc.)';
COMMENT ON TABLE location_floors IS 'Floors within a location (1st Floor, 2nd Floor, etc.)';
COMMENT ON TABLE location_rooms IS 'Rooms within a location (instances of room_types)';
COMMENT ON TABLE location_targets IS 'Targets within rooms (instances of target_types)';
COMMENT ON TABLE target_actions IS 'Actions on targets (instances of action_types)';

