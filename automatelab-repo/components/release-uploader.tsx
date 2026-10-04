"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function ReleaseUploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(formElement);
      const file = form.get("file") as File;
      const details = {
        version: Number(form.get("version")),
        title: String(form.get("title")),
        blueprintCount: Number(form.get("blueprintCount")),
        fileName: file.name,
        fileSize: file.size,
      };
      if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose the validated ZIP file.");
      const signResponse = await fetch("/api/admin/releases/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(details) });
      const signed = await signResponse.json() as { signedUrl?: string; path?: string; error?: string };
      if (!signResponse.ok || !signed.signedUrl || !signed.path) throw new Error(signed.error || "Upload could not start.");
      const uploadResponse = await fetch(signed.signedUrl, { method: "PUT", headers: { "Content-Type": "application/zip" }, body: file });
      if (!uploadResponse.ok) throw new Error("The ZIP upload failed.");
      const finishResponse = await fetch("/api/admin/releases/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...details, path: signed.path }) });
      const finished = await finishResponse.json() as { error?: string };
      if (!finishResponse.ok) throw new Error(finished.error || "Release could not be published.");
      setMessage("Release uploaded and published. Customer downloads now point to this ZIP.");
      formElement.reset();
      router.refresh();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="adminForm" onSubmit={submit}>
    <label>Release title<input name="title" required defaultValue="Make Selling Automation Blueprint Library" /></label>
    <label>Version<input name="version" type="number" min="1" required /></label>
    <label>Blueprint count<input name="blueprintCount" type="number" min="1" required defaultValue="100" /></label>
    <label>Validated ZIP<input name="file" type="file" required accept=".zip,application/zip" /></label>
    <button className="button primary" disabled={busy}>{busy ? "Uploading…" : "Upload and publish →"}</button>
    {message && <p className="formMessage" role="status">{message}</p>}
  </form>;
}
