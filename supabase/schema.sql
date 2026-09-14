-- Run once in the project's SQL editor. No public table or bucket access.
BEGIN;
CREATE TABLE IF NOT EXISTS projects(id text PRIMARY KEY,name text NOT NULL,deleted integer NOT NULL DEFAULT 0,"preserveRules" text,prompt text NOT NULL DEFAULT '',revision integer NOT NULL DEFAULT 0,created text NOT NULL);
CREATE TABLE IF NOT EXISTS assets(id text PRIMARY KEY,project text NOT NULL REFERENCES projects(id),name text NOT NULL,mime text NOT NULL,kind text NOT NULL,role text NOT NULL DEFAULT '材质',created text NOT NULL);
CREATE INDEX IF NOT EXISTS assets_project ON assets(project);
CREATE TABLE IF NOT EXISTS versions(id text PRIMARY KEY,project text NOT NULL REFERENCES projects(id),parent text,deleted integer NOT NULL DEFAULT 0,asset text NOT NULL REFERENCES assets(id),prompt text NOT NULL,"references" text NOT NULL DEFAULT '[]',created text NOT NULL);
CREATE INDEX IF NOT EXISTS versions_project ON versions(project);
CREATE TABLE IF NOT EXISTS edit_jobs(id text PRIMARY KEY,project text NOT NULL REFERENCES projects(id),parent text NOT NULL,prompt text NOT NULL,"references" text NOT NULL,model text NOT NULL,"preserveRules" text,status text NOT NULL,error text,version text,created text NOT NULL,updated text NOT NULL,phase text NOT NULL DEFAULT 'legacy',worker text,conversation text);
CREATE INDEX IF NOT EXISTS jobs_project ON edit_jobs(project);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_edit ON edit_jobs(status) WHERE status='running';
CREATE TABLE IF NOT EXISTS companion(id integer PRIMARY KEY,worker text NOT NULL,state text NOT NULL,updated text NOT NULL);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion ENABLE ROW LEVEL SECURITY;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('studio-private','studio-private',false,10485760,ARRAY['image/png','image/jpeg','image/webp','application/json']) ON CONFLICT(id) DO NOTHING;
COMMIT;
