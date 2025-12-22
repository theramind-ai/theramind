-- WARNING: DANGER ZONE
-- This script drops ALL tables in the database.
-- Data will be permanently lost.

DROP TABLE IF EXISTS copilot_messages CASCADE;
DROP TABLE IF EXISTS copilot_conversations CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
