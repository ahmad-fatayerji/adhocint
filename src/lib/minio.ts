import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
