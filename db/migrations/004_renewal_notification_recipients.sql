-- Track renewal email delivery per user so every active company user gets
-- one email, and a failure for one recipient can be retried independently.
alter table renewal_alert_notifications
  add column if not exists recipient_user_id uuid references app_users(id) on delete cascade;

alter table renewal_alert_notifications
  drop constraint if exists renewal_alert_notifications_line_item_id_alert_type_key;

create unique index if not exists renewal_alert_notifications_recipient_key
  on renewal_alert_notifications(line_item_id, alert_type, recipient_user_id)
  where recipient_user_id is not null;

create index if not exists idx_renewal_alert_notifications_recipient
  on renewal_alert_notifications(recipient_user_id, sent_at desc);
