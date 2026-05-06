-- Location assignments table
-- Links users (cleaners) to specific locations they can access

CREATE TABLE IF NOT EXISTS location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who is assigned
  user_id VARCHAR(255) NOT NULL,
  user_email VARCHAR(255),              -- Denormalized for display
  user_name VARCHAR(255),               -- Denormalized for display
  
  -- To which location
  location_id VARCHAR(255) NOT NULL,
  location_name VARCHAR(255),           -- Denormalized for display
  
  -- Assignment metadata
  assigned_by VARCHAR(255),             -- Admin who made the assignment
  assigned_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,       -- Soft delete support
  
  -- Prevent duplicate assignments
  UNIQUE(user_id, location_id),
  
  -- Foreign key constraints (optional - depends if locations table exists)
  -- FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_location_assignments_user 
  ON location_assignments(user_id) 
  WHERE is_active = true;

CREATE INDEX idx_location_assignments_location 
  ON location_assignments(location_id) 
  WHERE is_active = true;

CREATE INDEX idx_location_assignments_active 
  ON location_assignments(is_active, assigned_at);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_location_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER location_assignments_updated_at
  BEFORE UPDATE ON location_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_location_assignments_updated_at();

-- Comment for documentation
COMMENT ON TABLE location_assignments IS 'Maps users to locations they can access. Used to scope cleaner access to specific properties.';
COMMENT ON COLUMN location_assignments.user_id IS 'Firebase UID of the assigned user';
COMMENT ON COLUMN location_assignments.location_id IS 'UUID of the location from Firestore';
COMMENT ON COLUMN location_assignments.is_active IS 'Soft delete flag - set to false instead of deleting';



