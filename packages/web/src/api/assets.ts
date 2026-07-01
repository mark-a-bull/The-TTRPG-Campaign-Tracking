import { useMutation } from "@tanstack/react-query";
import { ApiError } from "./client.js";

async function uploadAsset(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/assets", { method: "POST", body: formData });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? response.statusText);
  }
  return response.json();
}

export function useUploadAsset() {
  return useMutation({ mutationFn: uploadAsset });
}
