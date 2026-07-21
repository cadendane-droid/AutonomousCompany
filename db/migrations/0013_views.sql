-- 0013: views — health score components, refresh queue, dashboard reads.
-- The "dashboard" at this stage IS these views (plan §7.5). No React app.
-- Reversal (manual): drop view <name>;

-- Daily per-tenant traffic rollup used by health score + anomaly detection.
create or replace view v_daily_traffic as
select
  b.tenant_id,
  b.date,
  sum(b.sessions)                as sessions,
  sum(b.users)                   as users,
  sum(b.returning_users)         as returning_users,
  avg(b.bounce_rate)             as bounce_rate
from behavior_metrics b
group by b.tenant_id, b.date;

-- Daily search rollup (impressions/clicks/CTR/position across all queries).
create or replace view v_daily_search as
select
  s.tenant_id,
  s.date,
  sum(s.impressions)                                   as impressions,
  sum(s.clicks)                                        as clicks,
  case when sum(s.impressions) > 0
       then sum(s.clicks)::numeric / sum(s.impressions) end as ctr,
  avg(s.position)                                      as avg_position
from search_metrics s
group by s.tenant_id, s.date;

-- Health score raw components, one row per tenant per day. The composite is
-- computed in packages/stats (phase-weighted, 30-day stability rule) — the
-- view only exposes the ingredients so the composite can be recomputed when
-- weights change.
create or replace view v_health_components as
select
  t.id                       as tenant_id,
  t.rung,
  d.date,
  d.sessions,
  d.returning_users,
  d.bounce_rate,
  s.impressions,
  s.clicks,
  s.ctr,
  s.avg_position,
  a.revenue,
  tech.lighthouse_avg,
  tech.indexed_pages,
  tech.crawl_errors,
  q.avg_quality_score
from tenants t
left join v_daily_traffic d on d.tenant_id = t.id
left join v_daily_search s on s.tenant_id = t.id and s.date = d.date
left join (
  select tenant_id, date, sum(revenue) as revenue
  from affiliate_metrics group by tenant_id, date
) a on a.tenant_id = t.id and a.date = d.date
left join (
  select tenant_id, date,
         avg(lighthouse)                          as lighthouse_avg,
         count(*) filter (where indexed)          as indexed_pages,
         sum(crawl_errors)                        as crawl_errors
  from technical_metrics group by tenant_id, date
) tech on tech.tenant_id = t.id and tech.date = d.date
left join (
  select tenant_id, avg(quality_score) as avg_quality_score
  from pages group by tenant_id
) q on q.tenant_id = t.id;

-- Refresh queue (plan §8.2): rank pages by quality, staleness, and near-miss
-- position (8–20). Impression/click data joined over the trailing 28 days.
create or replace view v_refresh_queue as
with recent as (
  select page_id,
         sum(impressions) as impressions_28d,
         sum(clicks)      as clicks_28d,
         avg(position)    as avg_position_28d
  from search_metrics
  where date >= current_date - 28
  group by page_id
)
select
  p.tenant_id,
  p.id as page_id,
  p.path,
  p.type,
  p.cluster,
  p.quality_score,
  p.updated_at,
  r.impressions_28d,
  r.clicks_28d,
  r.avg_position_28d,
  -- composite priority: low quality + stale + impressions-without-clicks +
  -- near-miss positions rank highest
  coalesce(5 - p.quality_score, 2.5)                                       * 2
    + least(coalesce(current_date - p.updated_at, 180), 365) / 90.0
    + case when coalesce(r.impressions_28d, 0) > 100
            and coalesce(r.clicks_28d, 0) = 0 then 3 else 0 end
    + case when r.avg_position_28d between 8 and 20 then 3 else 0 end
    as refresh_priority
from pages p
left join recent r on r.page_id = p.id
where p.protected = false
order by refresh_priority desc;

-- Dashboard: recent decisions
create or replace view v_recent_decisions as
select d.tenant_id, d.date, d.role, d.kind, d.summary, d.measurable,
       d.rollback_ref, d.pr_url, d.outcome
from decisions d
order by d.date desc
limit 100;

-- Dashboard: connector freshness — the "silent gap" detector's read path
create or replace view v_ingest_freshness as
select connector,
       tenant_id,
       max(started_at) filter (where status = 'ok')  as last_success,
       max(started_at)                               as last_attempt,
       (select count(*) from ingest_runs r2
        where r2.connector = r.connector and r2.status = 'failed'
          and r2.started_at > now() - interval '7 days') as failures_7d
from ingest_runs r
group by connector, tenant_id;

-- Dashboard: LLM spend this calendar month vs budget (budget lives in env)
create or replace view v_llm_spend_month as
select coalesce(tenant_id::text, 'platform') as tenant,
       date_trunc('month', created_at)       as month,
       sum(cost_usd)                         as spend_usd,
       count(*)                              as calls
from agent_runs
group by 1, 2;
