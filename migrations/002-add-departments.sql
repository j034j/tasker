-- Create departments table and link boards to departments
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  admin_user_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(org_id) REFERENCES organizations(id),
  FOREIGN KEY(admin_user_id) REFERENCES users(id)
);

-- Associate boards with departments (nullable)
ALTER TABLE boards ADD COLUMN department_id TEXT;
CREATE INDEX IF NOT EXISTS idx_boards_department_id ON boards(department_id);
