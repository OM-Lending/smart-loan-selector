# Customer application continuation

## Private document storage setup

The document upload endpoint uses Supabase Storage from the server. Create a private bucket named `application-documents` in the same Supabase project as the database. Do not make the bucket public. The server validates uploads as PDF, JPG, or PNG, caps each file at 10 MB, and stores only a private object path and file metadata in Postgres.

Set these server-side environment variables in local development and Vercel:

- `SUPABASE_SECRET_KEY`: the Supabase Secret API key (`sb_secret_...`). Never expose it with a `NEXT_PUBLIC_` prefix or commit it. The older `SUPABASE_SERVICE_ROLE_KEY` variable is also accepted for a legacy JWT-based `service_role` key.
- `SUPABASE_APPLICATION_DOCUMENTS_BUCKET`: optional; defaults to `application-documents`.

The existing `NEXT_PUBLIC_SUPABASE_URL` supplies the project URL. Uploads return a setup error until the private bucket and server-side key are configured. New Supabase Secret keys are sent only using the `apikey` header; legacy JWT service-role keys are also sent as a Bearer token.
