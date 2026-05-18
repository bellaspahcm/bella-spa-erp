-- Disable RLS for attendance table to allow admin override updates to succeed without policy violation
ALTER TABLE "public"."attendance" DISABLE ROW LEVEL SECURITY;
