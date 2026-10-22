const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function fixture({ send, fetch, dbError } = {}) {
  const events = [];
  const commands = {};
  for (const name of ['GetObjectCommand', 'PutObjectCommand', 'DeleteObjectCommand', 'HeadObjectCommand']) {
    commands[name] = class { constructor(input) { this.input = input; this.kind = name; } };
  }
  commands.S3Client = class { send(command) { return send(command); } };
  const pg = { Client: class {
    async connect() { if (dbError) throw dbError; }
    async query() { return { rows: [{ ok: 1 }] }; }
    async end() {}
  } };
  const fakeRequire = name => {
    if (name === 'node:module') return { createRequire: () => dependency => {
      if (dependency === '@aws-sdk/client-s3') return commands;
      if (dependency === 'pg') return pg;
      if (dependency === 'sharp') return () => ({ metadata: async () => ({ width: 10 }) });
      throw new Error('Unexpected dependency');
    } };
    return require(name);
  };
  const module = { exports: {} };
  const response = body => ({ status: 200, json: async () => body,
    arrayBuffer: async () => Buffer.alloc(1024, 0x61) });
  vm.runInNewContext(fs.readFileSync(__dirname + '/probes.cjs', 'utf8'), {
    require: fakeRequire, module, Buffer, URL, URLSearchParams, AbortSignal, FormData, Blob,
    console: { log: line => events.push(JSON.parse(line)) },
    process: { env: { MINIO_BUCKET: 'test', MINIO_ACCESS_KEY: 'test', MINIO_SECRET_KEY: 'private' } },
    fetch: fetch || (async () => response({ Version: '2.1.0', VersionInt: 20100 })),
  });
  return { probes: module.exports, events, response };
}
const pending = () => ({ key: '_monitoring/adhocint/write-00000000-0000-0000-0000-000000000000.bin' });
const missing = () => Object.assign(new Error(), { $metadata: { httpStatusCode: 404 } });

test('database credentials are tested and errors are sanitized', async () => {
  const { probes } = fixture({ dbError: Object.assign(new Error('secret connection string'), { code: '28P01' }) });
  await assert.rejects(probes.db(), error => probes.safeError(error) === 'database_authentication_failed');
});
test('storage read denial remains a failure', async () => {
  const { probes } = fixture({ send: async () => { throw Object.assign(new Error('secret'), { name: 'AccessDenied' }); } });
  await assert.rejects(probes.storageRead(), error => probes.safeError(error) === 'storage_access_denied');
});
test('write denial is reported even when cleanup succeeds', async () => {
  const { probes } = fixture({ send: async command => {
    if (command.kind === 'PutObjectCommand') throw Object.assign(new Error(), { name: 'AccessDenied' });
    if (command.kind === 'HeadObjectCommand') throw missing();
    return {};
  } });
  await assert.rejects(probes.storageWrite(pending()), error => probes.safeError(error) === 'storage_access_denied');
});
test('corrupt canary contents fail and the test object is cleaned up', async () => {
  let deleted = false;
  const { probes, events } = fixture({ send: async command => {
    if (command.kind === 'GetObjectCommand') return { Body: { transformToByteArray: async () => Buffer.from('corrupt') } };
    if (command.kind === 'DeleteObjectCommand') deleted = true;
    if (command.kind === 'HeadObjectCommand') throw missing();
    return {};
  } });
  await assert.rejects(probes.storageWrite(pending()), /storage_content_mismatch/);
  assert.equal(deleted, true);
  assert.equal(events.at(-1).value, null);
});
test('cleanup denial retains the pending canary for recovery', async () => {
  const { probes, events } = fixture({ send: async command => {
    if (command.kind === 'GetObjectCommand') return { Body: { transformToByteArray: async () => Buffer.alloc(1024, 0x61) } };
    if (command.kind === 'DeleteObjectCommand') throw new Error('denied');
    return {};
  } });
  await assert.rejects(probes.storageWrite(pending()), /storage_cleanup_failed/);
  assert.ok(events.at(-1).value.key);
});
test('HTML/error pages and malformed JSON never count as API success', async () => {
  let f = fixture({ fetch: async () => ({ status: 503 }) });
  await assert.rejects(f.probes.images(), /unexpected_http_status/);
  f = fixture({ fetch: async () => ({ status: 200, json: async () => { throw new SyntaxError(); } }) });
  await assert.rejects(f.probes.gokapiApi(), /invalid_json_response/);
  f = fixture({ fetch: async () => ({ status: 200, json: async () => ({ login: true }) }) });
  await assert.rejects(f.probes.gokapiApi(), /invalid_gokapi_response/);
});
test('empty published catalogue is valid', async () => {
  const { probes } = fixture({ fetch: async () => ({ status: 200, json: async () => ({ ok: true, projects: [] }) }) });
  assert.match(await probes.images(), /empty published catalogue/);
});
test('file cleanup failure is reported without losing its identifier', async () => {
  const { probes, events } = fixture({ fetch: async (url, options) => {
    if (options.method === 'DELETE') return { status: 500 };
    return { status: 200, headers: { getSetCookie: () => ['ptest-owned-file=fixture; Path=/'] },
      arrayBuffer: async () => Buffer.alloc(1024, 0x61) };
  } });
  await assert.rejects(probes.gokapiTransfer({ name: 'adhoc-monitor-00000000-0000-0000-0000-000000000000.txt',
    password: 'test-only', id: 'test-owned-file' }), /file_cleanup_failed/);
  assert.equal(events.length, 0);
});

test('file transfer corruption fails while successful cleanup clears its identifier', async () => {
  const { probes, events } = fixture({ fetch: async (url, options) => {
    if (options.method === 'DELETE') return { status: 200 };
    return { status: 200, headers: { getSetCookie: () => ['ptest-owned-file=fixture; Path=/'] },
      arrayBuffer: async () => Buffer.from('corrupt') };
  } });
  await assert.rejects(probes.gokapiTransfer({ name: 'adhoc-monitor-00000000-0000-0000-0000-000000000000.txt',
    password: 'test-only', id: 'test-owned-file' }), /download_content_mismatch/);
  assert.equal(events.at(-1).value, null);
});
