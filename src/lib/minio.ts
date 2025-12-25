import {
    S3Client,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

function required(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

export function getMinioClient() {
    const endpoint = required("MINIO_ENDPOINT");
    const accessKeyId = required("MINIO_ACCESS_KEY");
    const secretAccessKey = required("MINIO_SECRET_KEY");

    return new S3Client({
        region: "us-east-1",
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
    });
}

export async function getObjectStream(opts: {
    bucket: string;
    key: string;
}) {
    const client = getMinioClient();
    const command = new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key });
    const res = await client.send(command);

    const body: any = res.Body;
    if (!body) return null;

    const stream: ReadableStream<Uint8Array> =
        typeof body?.getReader === "function"
            ? (body as ReadableStream<Uint8Array>)
            : (Readable.toWeb(body as any) as unknown as ReadableStream<Uint8Array>);

    return {
        stream,
        contentType: res.ContentType,
        contentLength: typeof res.ContentLength === "number" ? res.ContentLength : undefined,
        etag: res.ETag,
    };
}

export async function putObject(opts: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType?: string;
}) {
    const client = getMinioClient();
    const command = new PutObjectCommand({
        Bucket: opts.bucket,
        Key: opts.key,
        Body: opts.body,
        ContentType: opts.contentType,
    });
    await client.send(command);
}

export async function presignGetObject(opts: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
}) {
    const client = getMinioClient();
    const command = new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key });
    return getSignedUrl(client, command, { expiresIn: opts.expiresInSeconds ?? 900 });
}

export async function presignPutObject(opts: {
    bucket: string;
    key: string;
    contentType?: string;
    expiresInSeconds?: number;
}) {
    const client = getMinioClient();
    const command = new PutObjectCommand({
        Bucket: opts.bucket,
        Key: opts.key,
        ContentType: opts.contentType,
    });
    return getSignedUrl(client, command, { expiresIn: opts.expiresInSeconds ?? 900 });
}

export async function deleteObject(opts: { bucket: string; key: string }) {
    const client = getMinioClient();
    const command = new DeleteObjectCommand({ Bucket: opts.bucket, Key: opts.key });
    await client.send(command);
}
