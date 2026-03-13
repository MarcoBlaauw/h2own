import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { env } from "../env.js";

const TOTP_ISSUER = "H2Own";

const getEncryptionKey = () =>
  createHash("sha256").update(env.SESSION_SECRET).digest();

const encode = (value: Buffer) => value.toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url");

const normalizeToken = (token: string) => token.replace(/\s+/g, "").trim();

const encryptSecret = (plainSecret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainSecret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${encode(iv)}:${encode(authTag)}:${encode(encrypted)}`;
};

const decryptSecret = (payload: string) => {
  const [ivRaw, authTagRaw, encryptedRaw] = payload.split(":");
  if (!ivRaw || !authTagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted TOTP secret payload");
  }

  const iv = decode(ivRaw);
  const authTag = decode(authTagRaw);
  const encrypted = decode(encryptedRaw);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
};

export const totpService = {
  async createEnrollment(email: string) {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: TOTP_ISSUER,
      label: email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 256 });

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  },

  encryptSecret,
  decryptSecret,

  verifyToken(secret: string, token: string) {
    const normalized = normalizeToken(token);
    if (!/^\d{6}$/.test(normalized)) {
      return false;
    }
    return verifySync({
      secret,
      token: normalized,
    }).valid;
  },
};
