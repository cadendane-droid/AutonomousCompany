-- 0001: extensions
-- pgvector for semantic recall of decisions; pgcrypto for gen_random_uuid().
-- Reversal (manual): drop extension vector; drop extension pgcrypto;

create extension if not exists vector;
create extension if not exists pgcrypto;
