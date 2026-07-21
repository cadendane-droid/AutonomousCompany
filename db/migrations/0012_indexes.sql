-- 0012: indexes for the read paths the system actually has.
-- Reversal (manual): drop index <name>;

-- queue claim path: pending jobs by role, priority, age
create index if not exists idx_jobs_claim
  on jobs (role, status, priority, created_at)
  where status in ('pending', 'failed');

create index if not exists idx_jobs_status on jobs (status);
create index if not exists idx_agent_runs_job on agent_runs (job_id);
create index if not exists idx_agent_runs_created on agent_runs (created_at);

-- metrics read paths: per page over time
create index if not exists idx_search_metrics_page_date on search_metrics (page_id, date);
create index if not exists idx_behavior_metrics_page_date on behavior_metrics (page_id, date);
create index if not exists idx_affiliate_metrics_page_date on affiliate_metrics (page_id, date);
create index if not exists idx_technical_metrics_page_date on technical_metrics (page_id, date);

create index if not exists idx_decisions_tenant_date on decisions (tenant_id, date);
create index if not exists idx_external_events_date on external_events (date);
create index if not exists idx_ingest_runs_connector on ingest_runs (connector, started_at);
create index if not exists idx_pages_tenant_type on pages (tenant_id, type);
create index if not exists idx_knowledge_tier on knowledge (tier, scope);

-- semantic recall (pgvector). ivfflat needs rows to be useful; lists=100 is a
-- reasonable default that can be rebuilt when the table grows.
create index if not exists idx_decisions_embedding
  on decisions using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_knowledge_embedding
  on knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);
