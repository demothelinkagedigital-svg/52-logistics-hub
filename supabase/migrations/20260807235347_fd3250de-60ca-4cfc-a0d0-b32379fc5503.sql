REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_recruiting_staff(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_application_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_document_verification() FROM anon, authenticated;