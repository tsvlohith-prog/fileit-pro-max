-- 1. Add password, is_starred, and expiration to files
ALTER TABLE public.files 
ADD COLUMN password text,
ADD COLUMN is_starred boolean NOT NULL DEFAULT false,
ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
ADD COLUMN room_id text;

-- 2. Create Rooms table for private sharing
CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  name text NOT NULL,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 day')
);

-- 3. Add foreign key from files to rooms
ALTER TABLE public.files 
ADD CONSTRAINT fk_room FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;

-- 4. Expiration Cron Job (Requires pg_cron extension)
-- Deletes files and rooms that have expired
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('cleanup-expired-records', '0 * * * *', $$
  DELETE FROM public.rooms WHERE expires_at < now();
  DELETE FROM public.files WHERE is_starred = false AND expires_at < now();
$$);
