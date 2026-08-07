
REVOKE EXECUTE ON FUNCTION public.is_recruiting_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_content_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_recruiting_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_content_staff(uuid) TO authenticated, service_role;
