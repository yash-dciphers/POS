-- ============================================================================
-- Tracks whether an account's current password was chosen by an administrator
-- rather than by the person it belongs to.
--
-- Set when an Admin invites a user or resets their password (both of which
-- email the password to them), and cleared the moment the user sets their own.
-- Drives the prompt on the profile page and the status shown in Users & Roles,
-- so only people who still hold an admin-set password are nudged to change it.
--
-- Existing accounts default to false: they predate this flow and shouldn't be
-- retroactively nagged.
-- ============================================================================

alter table app_users
  add column if not exists password_set_by_admin boolean not null default false;
