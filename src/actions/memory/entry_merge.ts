import { Request, Response } from "express";
import { Firestore } from "@google-cloud/firestore";
import { google } from "googleapis";
import { Readable } from "stream";
import { impersonatedClient } from "../../google";

export async function memoryEntryMergeHandler(req: Request, res: Response) {
  try {
    const { userId, timestamps, mergeTitle } = req.body || {};
    if (!userId || !Array.isArray(timestamps) || !timestamps.length) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing userId/timestamps[]" });
    }
    const title = String(mergeTitle || "Merged Notes");
    const db = new Firestore();
    const coll = db
      .collection("memory_entries")
      .doc(String(userId))
      .collection("entries");
    const docs = await Promise.all(
      timestamps.map((ts: any) => coll.doc(String(ts)).get())
    );
    const lines: string[] = [];
    for (const d of docs) {
      if (!d.exists) continue;
      const e = d.data() as any;
      lines.push(`# ${new Date(e.ts).toISOString()}\n${String(e.text)}\n`);
    }
    const md = lines.join("\n");
    const folderId =
      process.env.MEMORY_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || "";
    if (!folderId)
      return res
        .status(500)
        .json({ ok: false, error: "Missing MEMORY_DRIVE_FOLDER_ID" });
    const user = process.env.IMPERSONATE_USER || process.env.GMAIL_SENDER || "";
    const ic = await impersonatedClient(user, [
      "https://www.googleapis.com/auth/drive",
    ]);
    const drive = google.drive({ version: "v3", auth: ic.auth });
    const stream = Readable.from(Buffer.from(md, "utf8"));
    const { data } = await drive.files.create({
      requestBody: { name: `${title}.md`, parents: [folderId] },
      media: { mimeType: "text/markdown", body: stream },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    } as any);
    return res.json({
      ok: true,
      id: (data as any).id,
      name: (data as any).name,
      webViewLink: (data as any).webViewLink,
    });
  } catch (e: any) {
    const status = e?.response?.status || 500;
    return res
      .status(status)
      .json({ ok: false, error: e?.message || "memory.entry.merge failed" });
  }
}
