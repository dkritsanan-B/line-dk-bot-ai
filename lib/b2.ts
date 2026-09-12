import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Backblaze B2 (S3-compatible) — ที่เก็บรูปภาพของ Agency OS (bucket แบบ Private)
const endpoint = process.env.B2_ENDPOINT!; // เช่น https://s3.us-east-005.backblazeb2.com
const region   = process.env.B2_REGION!;   // เช่น us-east-005
const bucket   = process.env.B2_BUCKET!;

export const b2 = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId:     process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true,
});

// อัพโหลดไฟล์ขึ้น B2 — คืน "key" (ที่อยู่ไฟล์ในถัง) เก็บลงฐานข้อมูล
export async function uploadToB2(key: string, body: Buffer, contentType: string): Promise<string> {
  await b2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return key;
}

// สร้างลิงก์ชั่วคราวสำหรับดูรูป (เพราะ bucket เป็น Private)
// หมดอายุใน expiresIn วินาที — ดีฟอลต์ 7 วัน (สูงสุดของ presigned S3)
export async function getSignedImageUrl(key: string, expiresIn = 604800): Promise<string | null> {
  try {
    return await getSignedUrl(b2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
  } catch {
    return null;
  }
}
