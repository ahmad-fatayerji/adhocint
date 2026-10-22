# Object storage operations

Production uses Chainguard MinIO `RELEASE.2026-09-22T19-25-18Z`, pinned in the
Quadlet and Compose files. This remains AGPL software. UID 0 is inside the
existing rootless Podman namespace; the production volume ownership is preserved.
Do not replace the digest or change ownership without rehearsing against a copy.

## Deployment and readiness

CI checks `shared/storage-migration.lock` before changing the environment or
units. The deploy script also checks it and serializes deployments with `flock`.
For a migration from an older workflow, pause deployment-key access as well;
an old workflow will not yet understand the lock. Restore key access afterward.

`ops/storage-common.sh` pins rclone v1.75.2. Its entrypoint maps `MINIO_*` variables
to an ephemeral S3 remote without persisting credentials in client configuration.
Bucket initialization waits for authenticated access and fails on creation errors.
No server-image `curl`, `wget`, or bundled `mc` is required. Compose waits for the
initializer to complete; Quadlet deployment performs the same S3 check.

The web unit requires the database and only wants object storage, so stopping
storage leaves ordinary pages running. Image requests may fail during maintenance.
The deploy script refuses an unexpected running storage image rather than
silently upgrading its on-disk data.

## Backups and restores

Run `bash ops/backup.sh` from the deployed repository. It uses the shared
production environment by default; `ENV_FILE` overrides it. Backups retain the
existing layout: `db.dump`, `minio/<bucket>/...`, and `manifest.txt`. Object copies
are checked by downloading and comparing content, with low transfer concurrency.
`bash ops/restore.sh /absolute/backup/path` accepts this layout, restores objects
before the database, and verifies copied bytes. Destination-only objects are
retained. Automatic backup deletion is disabled; manage retention explicitly.

Pause writers for a consistent database/object pair. These logical backups copy
current objects; they are not a complete backup of IAM, historical versions,
retention settings, bucket configuration, or all S3 metadata. Use a stopped-volume
archive for a complete storage migration/recovery backup. For isolated recovery
tests, `POSTGRES_CONTAINER` selects the database container and
`SKIP_SERVICE_START=1` prevents restore from starting production systemd units.

## Image upgrade procedure

1. Retain/export the old image and save the unit definitions and environment.
   Create `shared/storage-migration.lock`, pause deployments and background
   storage writers, block project mutation requests at the reverse proxy with
   `503`/`Retry-After`, and drain active requests.
2. Inventory all buckets, versions, delete markers, policies, encryption,
   retention, tags and other settings. Hash every object version's downloaded
   bytes and record metadata. Keep audit results private, outside Git.
3. Stop MinIO only. Archive the entire volume with numeric ownership, ACLs and
   xattrs in `podman unshare`, including `.minio.sys`. Dump PostgreSQL, validate
   the archive/dump, and verify an authorized off-server copy before cutover.
4. Restore the archive to an isolated volume and run the pinned candidate on it.
   Compare inventories, hashes, metadata and settings; test original/thumbnail
   PUT/GET/DELETE and missing-object responses. Never mount one volume into two
   running servers. Limit concurrent rehearsal processes on the small VPS.
5. Stop rehearsal and start the tested image on the original named volume, using
   the existing endpoint, credentials and container name. Repeat integrity and
   public-image checks. Reopen writes and deployment access only after success.

Before writes reopen, rollback means stopping the replacement, restoring the
untouched archive to a **new empty named volume**, and running the retained old
image against that restored volume. Keep the candidate-mutated volume for
investigation. Do not downgrade a modified volume in place. Restore the saved
database only if necessary and while all affected writers are stopped; avoid
discarding unrelated contact submissions made during storage maintenance.
After reopening writes, first freeze writers and preserve all post-cutover
changes before rollback. Keep the migration archives and old image for at least
14 days; never put backups, secrets, audit output or rehearsal artifacts in Git.
