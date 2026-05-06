-- Add structured taxonomy fields to jobs table
-- These are OPTIONAL to maintain backwards compatibility with existing tasks

-- Add structure columns
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS structure_floor VARCHAR(50),
ADD COLUMN IF NOT EXISTS structure_room VARCHAR(50),
ADD COLUMN IF NOT EXISTS structure_target VARCHAR(50),
ADD COLUMN IF NOT EXISTS structure_action VARCHAR(50),
ADD COLUMN IF NOT EXISTS structure_room_modifier VARCHAR(50);

-- Create indexes for fast querying
-- Robots will query: "Give me all 'wipe' actions in 'kitchen' rooms"
CREATE INDEX IF NOT EXISTS idx_jobs_structure_room 
  ON jobs(structure_room) 
  WHERE structure_room IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_structure_action 
  ON jobs(structure_action) 
  WHERE structure_action IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_structure_floor 
  ON jobs(structure_floor) 
  WHERE structure_floor IS NOT NULL;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_structure_composite 
  ON jobs(location_id, structure_room, structure_action) 
  WHERE structure_room IS NOT NULL AND structure_action IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN jobs.structure_floor IS 'Structured taxonomy: floor level (e.g., first_floor, basement)';
COMMENT ON COLUMN jobs.structure_room IS 'Structured taxonomy: room type (e.g., kitchen, bathroom)';
COMMENT ON COLUMN jobs.structure_target IS 'Structured taxonomy: specific target object (e.g., counter, mirror)';
COMMENT ON COLUMN jobs.structure_action IS 'Structured taxonomy: action verb (e.g., clean, wipe)';
COMMENT ON COLUMN jobs.structure_room_modifier IS 'Structured taxonomy: room qualifier (e.g., primary, guest)';



