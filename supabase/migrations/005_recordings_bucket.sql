-- Create the recordings storage bucket (private — only accessible via signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recordings',
  'recordings',
  false,
  52428800,  -- 50 MB per file
  ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/m4a', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/m4a', 'video/mp4'];

-- Service role has full access to recordings bucket
CREATE POLICY "Service role can manage recordings"
  ON storage.objects FOR ALL
  USING (bucket_id = 'recordings')
  WITH CHECK (bucket_id = 'recordings');
