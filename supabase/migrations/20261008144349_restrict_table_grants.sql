-- Remove Supabase project defaults (which can grant all table privileges to
-- API roles) and restore least-privilege access for the app.
revoke all on
  public.folders, public.vocabularies, public.review_logs,
  public.quiz_results, public.quiz_result_folders, public.mistake_logs
  from anon, authenticated;

grant select, insert, update, delete on
  public.folders, public.vocabularies, public.mistake_logs
  to authenticated;
grant select, insert on
  public.review_logs, public.quiz_results, public.quiz_result_folders
  to authenticated;
