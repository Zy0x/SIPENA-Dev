create table if not exists public.viewport_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  observed_at timestamptz not null default now(),
  route_path text not null default '/',
  viewport_profile text not null check (
    viewport_profile in (
      'mobile-small',
      'mobile-regular',
      'mobile-large',
      'mobile-landscape',
      'tablet-portrait',
      'tablet-landscape',
      'desktop'
    )
  ),
  viewport_width integer not null check (viewport_width > 0),
  viewport_height integer not null check (viewport_height > 0),
  visual_viewport_width integer null check (visual_viewport_width is null or visual_viewport_width > 0),
  visual_viewport_height integer null check (visual_viewport_height is null or visual_viewport_height > 0),
  visual_viewport_offset_top integer null check (visual_viewport_offset_top is null or visual_viewport_offset_top >= 0),
  visual_viewport_offset_left integer null check (visual_viewport_offset_left is null or visual_viewport_offset_left >= 0),
  screen_width integer null check (screen_width is null or screen_width > 0),
  screen_height integer null check (screen_height is null or screen_height > 0),
  screen_avail_width integer null check (screen_avail_width is null or screen_avail_width > 0),
  screen_avail_height integer null check (screen_avail_height is null or screen_avail_height > 0),
  device_pixel_ratio numeric(5, 2) null check (device_pixel_ratio is null or device_pixel_ratio > 0),
  orientation text not null default 'unknown' check (orientation in ('portrait', 'landscape', 'unknown')),
  display_mode text not null default 'browser' check (display_mode in ('browser', 'standalone', 'fullscreen', 'minimal-ui', 'unknown')),
  touch_points integer not null default 0 check (touch_points >= 0),
  safe_area_top integer not null default 0 check (safe_area_top >= 0),
  safe_area_right integer not null default 0 check (safe_area_right >= 0),
  safe_area_bottom integer not null default 0 check (safe_area_bottom >= 0),
  safe_area_left integer not null default 0 check (safe_area_left >= 0),
  has_display_cutout boolean not null default false,
  viewport_key text not null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.viewport_observations enable row level security;

drop policy if exists "Users can insert their own viewport observations"
  on public.viewport_observations;
drop policy if exists "Users can view their own viewport observations"
  on public.viewport_observations;

create policy "Users can insert their own viewport observations"
on public.viewport_observations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can view their own viewport observations"
on public.viewport_observations
for select
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists idx_viewport_observations_user_observed
  on public.viewport_observations(user_id, observed_at desc);

create index if not exists idx_viewport_observations_profile_observed
  on public.viewport_observations(viewport_profile, observed_at desc);

create index if not exists idx_viewport_observations_route_observed
  on public.viewport_observations(route_path, observed_at desc);

grant select, insert on public.viewport_observations to authenticated;
