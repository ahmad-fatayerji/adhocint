// Executed in the application image, independently of its running web process.
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const req = createRequire('/app/package.json');
const s3 = req('@aws-sdk/client-s3');
const { Client } = req('pg');
const sharp = req('sharp');
const PREFIX = '_monitoring/adhocint/';
const READ_KEY = PREFIX + 'read-canary-v1.bin';
const content = Buffer.alloc(1024, 0x61);
const bucket = process.env.MINIO_BUCKET;
const storage = new s3.S3Client({ region: 'us-east-1', forcePathStyle: true,
  endpoint: process.env.MINIO_ENDPOINT, maxAttempts: 1,
  credentials: { accessKeyId: process.env.MINIO_ACCESS_KEY, secretAccessKey: process.env.MINIO_SECRET_KEY } });
function emit(value) { console.log(JSON.stringify(value)); }
function fail(code) { const e = new Error(code); e.probeCode = code; throw e; }
function check(condition, code) { if (!condition) fail(code); }
function send(Command, args) { return storage.send(new Command({ Bucket: bucket, ...args }), { abortSignal: AbortSignal.timeout(4000) }); }
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function safeError(error) {
  if (error.probeCode) return error.probeCode;
  if (error.code === '28P01' || error.code === '28000') return 'database_authentication_failed';
  if (['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch'].includes(error.name)) return 'storage_access_denied';
  if (['TimeoutError', 'AbortError'].includes(error.name)) return 'request_timeout';
  return 'check_failed'; // Never expose connection strings, keys, URLs or response bodies.
}
async function http(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(6000), ...options });
  check(response.status === 200, 'unexpected_http_status');
  return response;
}
async function json(url, options) {
  const response = await http(url, options);
  try { return await response.json(); } catch { fail('invalid_json_response'); }
}
const gokapiBase = () => process.env.GOKAPI_URL || 'https://share.adhocint.com';
function apiOptions(extra = {}) { return { ...extra, headers: { apikey: process.env.GOKAPI_API_KEY, ...extra.headers } }; }
async function db() {
  const client = new Client({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 4000, query_timeout: 4000, statement_timeout: 4000 });
  try { await client.connect(); check((await client.query('SELECT 1 AS ok')).rows[0].ok === 1, 'database_query_failed'); }
  finally { await client.end().catch(() => {}); }
  return 'authenticated SQL query succeeded';
}
async function storageRead() {
  const object = await send(s3.GetObjectCommand, { Key: READ_KEY });
  check(Buffer.from(await object.Body.transformToByteArray()).equals(content), 'storage_content_mismatch');
  return 'authenticated canary read verified';
}
async function storageWrite(pending) {
  check(pending && /^_monitoring\/adhocint\/write-[0-9a-f-]{36}\.bin$/.test(pending.key), 'invalid_canary_key');
  let originalError;
  try {
    const result = await send(s3.PutObjectCommand, { Key: pending.key, Body: content,
      ContentType: 'application/octet-stream', Metadata: { purpose: 'adhocint-monitoring' } });
    pending.versionId = result.VersionId;
    emit({ event: 'pending', kind: 'storage', value: pending });
    const object = await send(s3.GetObjectCommand, { Key: pending.key, VersionId: pending.versionId });
    check(Buffer.from(await object.Body.transformToByteArray()).equals(content), 'storage_content_mismatch');
  } catch (error) { originalError = error; }
  try {
    await send(s3.DeleteObjectCommand, { Key: pending.key, VersionId: pending.versionId });
    try { await send(s3.HeadObjectCommand, { Key: pending.key, VersionId: pending.versionId }); fail('storage_delete_failed'); }
    catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
    emit({ event: 'pending', kind: 'storage', value: null });
  } catch { fail('storage_cleanup_failed'); }
  if (originalError) throw originalError;
  return '1 KB PUT/GET/checksum/DELETE verified';
}
async function images() {
  const projectData = await json('https://adhocint.com/api/public/projects');
  check(projectData.ok === true && Array.isArray(projectData.projects), 'invalid_projects_response');
  const image = projectData.projects.flatMap(project => project.images || [])[0];
  if (!image) return 'empty published catalogue; no image to sample';
  for (const path of [image.fullUrl, image.thumbUrl]) {
    check(typeof path === 'string' && path.startsWith('/api/public/project-images/'), 'invalid_image_path');
    const response = await http(new URL(path, 'https://adhocint.com'));
    check((response.headers.get('content-type') || '').startsWith('image/'), 'invalid_image_content_type');
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length; check(size <= 50 * 1024 * 1024, 'image_response_too_large'); chunks.push(chunk);
    }
    check(size > 0, 'empty_image_response');
    check((await sharp(Buffer.concat(chunks)).metadata()).width > 0, 'invalid_image_bytes');
  }
  return 'published original and thumbnail decoded';
}
async function gokapiApi() {
  const value = await json(gokapiBase() + '/api/info/version', apiOptions());
  check(value && typeof value.Version === 'string' && Number.isInteger(value.VersionInt), 'invalid_gokapi_response');
  return 'authenticated file-sharing API responded';
}
// Gokapi transfer implementation uses its documented API and password form.
async function gokapiTransfer(pending) {
  check(pending && /^adhoc-monitor-[0-9a-f-]{36}\.txt$/.test(pending.name), 'invalid_test_filename');
  const base = gokapiBase();
  if (!pending.id) {
    // Recover an upload whose response/checkpoint was interrupted. This account
    // has access only to its own files; match the exact persisted random name.
    const list = await json(base + '/api/files/list', apiOptions());
    const files = list === null ? [] : Array.isArray(list) ? list : Object.values(list.Files || list.files || list);
    const found = files.find(file => file && (file.Name || file.name) === pending.name);
    if (found) pending.id = found.Id || found.id;
    if (!pending.id) {
      const body = new FormData();
      body.set('file', new Blob([content], { type: 'text/plain' }), pending.name);
      body.set('allowedDownloads', '2'); body.set('expiryDays', '1'); body.set('password', pending.password);
      const result = await json(base + '/api/files/add', apiOptions({ method: 'POST', body }));
      pending.id = result.Id || result.id || result.FileInfo?.Id || result.FileInfo?.id;
      check(typeof pending.id === 'string' && pending.id.length > 0, 'upload_missing_file_id');
    }
    emit({ event: 'pending', kind: 'gokapi', value: pending });
  }
  let originalError;
  try {
    const auth = new URLSearchParams({ id: pending.id, password: pending.password });
    const login = await http(base + '/d?id=' + encodeURIComponent(pending.id), {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: auth });
    const cookies = login.headers.getSetCookie().map(value => value.split(';')[0]);
    check(cookies.some(value => value.startsWith('p' + pending.id + '=')), 'file_password_authentication_failed');
    const response = await http(base + '/downloadFile?id=' + encodeURIComponent(pending.id), {
      headers: { cookie: cookies.join('; ') } });
    check(hash(Buffer.from(await response.arrayBuffer())) === hash(content), 'download_content_mismatch');
  } catch (error) { originalError = error; }
  try {
    const deleted = await fetch(base + '/api/files/delete', apiOptions({ method: 'DELETE',
      signal: AbortSignal.timeout(6000), headers: { id: pending.id, delay: '0' } }));
    check(deleted.status === 200 || deleted.status === 404, 'file_cleanup_failed');
    emit({ event: 'pending', kind: 'gokapi', value: null });
  } catch { fail('file_cleanup_failed'); }
  if (originalError) throw originalError;
  return 'password-protected upload/download/checksum/delete verified';
}
async function main() {
  const chunks = []; for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString());
  if (input.seed) {
    await send(s3.PutObjectCommand, { Key: READ_KEY, Body: content, ContentType: 'application/octet-stream',
      Metadata: { purpose: 'adhocint-monitoring' } });
    emit({ event: 'seeded' }); return;
  }
  const checks = { db, storage_read: storageRead, storage_write: () => storageWrite(input.pending.storage),
    images, gokapi_api: gokapiApi, gokapi_transfer: () => gokapiTransfer(input.pending.gokapi) };
  for (const name of input.tasks) {
    const started = Date.now();
    try { emit({ event: 'result', name, ok: true, message: await checks[name](), ms: Date.now() - started }); }
    catch (error) { emit({ event: 'result', name, ok: false, message: safeError(error), ms: Date.now() - started }); }
  }
}
if (require.main === module) {
  main().catch(() => { console.error('Probe process failed'); process.exitCode = 1; });
}
module.exports = { db, storageRead, storageWrite, images, gokapiApi, gokapiTransfer, safeError };
