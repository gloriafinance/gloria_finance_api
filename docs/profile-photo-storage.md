# Profile photo storage

Profile photos are received as raw `image/jpeg`, `image/png`, or `image/webp`
request bodies. The API streams them through Sharp, stores only a 1024 px WebP
derivative, and never persists the original upload.

Objects under `profile-photos/staged/` are waiting for a public registration to
complete. Configure the `BUCKET_FILES` bucket with a GCS lifecycle rule that
deletes that prefix after one day. Final objects live under `profile-photos/`.
