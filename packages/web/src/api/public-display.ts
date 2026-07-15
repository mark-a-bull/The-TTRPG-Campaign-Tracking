import { useQuery } from "@tanstack/react-query";
import type { PublicDisplay } from "@ttrpg/shared";
import { apiFetch } from "./client.js";

export function usePublicDisplay(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", campaignId ?? "", "public-display"],
    queryFn: () => apiFetch<PublicDisplay>(`/campaigns/${campaignId}/public-display`),
    enabled: Boolean(campaignId),
    refetchInterval: 5000,
    // This screen is meant to run passively on a second monitor/TV that
    // rarely has OS focus -- TanStack Query's default pauses polling for
    // exactly that "backgrounded" state, which would leave the display
    // stale for as long as it isn't the focused window.
    refetchIntervalInBackground: true,
    // A 404 (bad/deleted campaign link) isn't transient -- retrying with
    // the default backoff (up to ~7s for 3 attempts) raced against the 5s
    // poll interval and kept restarting the retry cycle before the error
    // ever settled, so the "not found" state never rendered.
    retry: false,
  });
}
