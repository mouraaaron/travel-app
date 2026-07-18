import { toast } from "sonner";

export type MutationBody = { error?: string; [key: string]: unknown } | null;

export async function mutateWithToast(
  url: string,
  init: RequestInit,
  messages: { success?: string; error: string }
): Promise<{ ok: boolean; body: MutationBody }> {
  try {
    const response = await fetch(url, init);
    const body: MutationBody = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(body?.error ?? messages.error);
      return { ok: false, body };
    }
    if (messages.success) {
      toast.success(messages.success);
    }
    return { ok: true, body };
  } catch {
    toast.error(messages.error);
    return { ok: false, body: null };
  }
}
