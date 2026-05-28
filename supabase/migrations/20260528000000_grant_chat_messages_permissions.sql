-- Grant privileges on chat_messages to authenticated and anon roles to fix client-side chat issues
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated, anon;
