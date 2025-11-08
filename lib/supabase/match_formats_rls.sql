-- Row Level Security policies for match_formats table

-- Enable RLS on match_formats table
alter table public.match_formats enable row level security;

-- Allow all authenticated users to view match formats
create policy "Authenticated users can view all match formats"
  on public.match_formats for select
  using (auth.role() = 'authenticated');

-- Allow all authenticated users to create match formats
create policy "Authenticated users can create match formats"
  on public.match_formats for insert
  with check (auth.role() = 'authenticated');

-- Allow users to update match formats (can be restricted later if needed)
create policy "Authenticated users can update match formats"
  on public.match_formats for update
  using (auth.role() = 'authenticated');

-- Allow users to delete match formats (can be restricted later if needed)
create policy "Authenticated users can delete match formats"
  on public.match_formats for delete
  using (auth.role() = 'authenticated');

-- Add to realtime publication
alter publication supabase_realtime add table "public"."match_formats";

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_match_formats_timestamps ON public.match_formats (created_at, updated_at);

-- Add trigger for updated_at
CREATE TRIGGER update_match_formats_updated_at
    BEFORE UPDATE ON public.match_formats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
