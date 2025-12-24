import crypto from "crypto";

export function randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString("base64url");
}

export function hmacSha256Hex(secret: string, value: string): string {
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export function getRequiredEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}
