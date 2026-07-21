-- 0004: metrics tables — implementation plan §4.1, transcribed exactly.
-- search, behavior, affiliate, technical. One row per page per day
-- (search adds query/country/device dimensions).
-- Reversal (manual): drop table search_metrics, behavior_metrics,
--   affiliate_metrics, technical_metrics;

-- daily search metrics, one row per page per query per day
create table if not exists search_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  query         text,
  country       text,
  device        text,
  impressions   int not null default 0,
  clicks        int not null default 0,
  position      numeric,
  primary key (tenant_id, date, page_id, query, country, device)
);

create table if not exists behavior_metrics (
  tenant_id       uuid not null references tenants(id),
  page_id         uuid references pages(id),
  date            date not null,
  sessions        int,
  users           int,
  returning_users int,
  bounce_rate     numeric,
  avg_duration    numeric,
  scroll_depth_p50 numeric,
  exits           int,
  primary key (tenant_id, date, page_id)
);

create table if not exists affiliate_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  clicks        int default 0,
  conversions   int default 0,
  revenue      numeric default 0,
  primary key (tenant_id, date, page_id)
);

create table if not exists technical_metrics (
  tenant_id     uuid not null references tenants(id),
  page_id       uuid references pages(id),
  date          date not null,
  lcp           numeric,
  cls           numeric,
  inp           numeric,
  lighthouse    int,
  indexed       boolean,
  crawl_errors  int,
  primary key (tenant_id, date, page_id)
);
