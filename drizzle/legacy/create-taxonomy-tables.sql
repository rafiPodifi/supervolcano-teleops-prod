-- ============================================
-- Task Taxonomy System - Database Schema
-- ============================================
-- Creates task_categories and task_templates tables
-- Extends jobs table with template_id, custom_steps, custom_tools
-- ============================================

-- Task Categories
-- Top-level groupings like "Kitchen", "Bathroom", "General"
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),                    -- lucide-react icon name
  color VARCHAR(20),                    -- hex color for UI
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Task Templates
-- Reusable blueprints for common tasks
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Structured instructions
  steps JSONB,                         -- Array of step objects: [{ order, title, description }]
  tools_required JSONB,                -- Array of tools: ["dish soap", "sponge"]
  safety_notes JSONB,                  -- Array of safety warnings
  
  -- Media
  instruction_video_url TEXT,          -- Firebase Storage URL
  instruction_images JSONB,            -- Array of image URLs
  
  -- Metadata
  estimated_duration_minutes INTEGER,
  difficulty_level VARCHAR(50),        -- 'easy', 'medium', 'hard'
  priority VARCHAR(50) DEFAULT 'medium',
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Task Instances (extends existing jobs table)
-- These are the actual tasks created from templates
-- NOTE: We'll add template_id column to existing jobs table

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS custom_steps JSONB;  -- Location-specific overrides
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS custom_tools JSONB;  -- Location-specific tools

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_categories_active ON task_categories(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_task_templates_usage ON task_templates(usage_count DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_template ON jobs(template_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_categories_updated_at
  BEFORE UPDATE ON task_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomy_updated_at();

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_taxonomy_updated_at();

-- Sample data
INSERT INTO task_categories (name, description, icon, color, sort_order) VALUES
  ('Kitchen', 'Kitchen cleaning and maintenance tasks', 'ChefHat', '#3B82F6', 1),
  ('Bathroom', 'Bathroom cleaning tasks', 'Bath', '#8B5CF6', 2),
  ('General', 'General cleaning and maintenance', 'Home', '#10B981', 3),
  ('Outdoor', 'Outdoor maintenance tasks', 'Trees', '#F59E0B', 4)
ON CONFLICT DO NOTHING;

-- Sample templates
INSERT INTO task_templates (
  category_id,
  name,
  description,
  steps,
  tools_required,
  estimated_duration_minutes,
  difficulty_level,
  priority
) VALUES (
  (SELECT id FROM task_categories WHERE name = 'Kitchen' LIMIT 1),
  'Clean Kitchen Sink',
  'Deep clean kitchen sink with soap and sponge',
  '[
    {"order": 1, "title": "Rinse sink", "description": "Run hot water to rinse out any debris"},
    {"order": 2, "title": "Apply soap", "description": "Squirt dish soap around the sink basin"},
    {"order": 3, "title": "Scrub thoroughly", "description": "Use sponge to scrub all surfaces, including faucet"},
    {"order": 4, "title": "Rinse clean", "description": "Rinse thoroughly with hot water until no soap remains"}
  ]'::jsonb,
  '["Dish soap", "Sponge", "Hot water"]'::jsonb,
  10,
  'easy',
  'medium'
) ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE task_categories IS 'Top-level task groupings';
COMMENT ON TABLE task_templates IS 'Reusable task blueprints with structured instructions';
COMMENT ON COLUMN task_templates.steps IS 'Ordered array of steps: [{ order, title, description }]';
COMMENT ON COLUMN task_templates.tools_required IS 'Array of required tools/supplies';

