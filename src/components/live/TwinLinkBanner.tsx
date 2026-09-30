// The slim strip a cockpit shows when the twin opened it on a run (lib/twin/twinLink.ts):
// "Live from the twin · run 4b09… · Back to the twin", or why that run cannot be shown.
// Renders nothing for a cockpit opened any other way. Shared file-for-file with the sibling cockpit.
import { ArrowUpRight, Radio } from "lucide-react";
import { useTwinPin } from "@/lib/twin/hooks";
import { clearTwinLink, pinMessage, twinBackUrl } from "@/lib/twin/twinLink";

function followLiveRun() {
  clearTwinLink();
  // Reload without the twin's parameters: every panel goes back to following the newest live run.
  window.location.assign(window.location.pathname);
}

export function TwinLinkBanner() {
  const pin = useTwinPin();
  if (!pin) return null;
  const { link, state } = pin;
  // Framed beside the depot, the twin's own panel header already names the run: speak only when
  // something is wrong. There is no "back" from inside the twin, and the twin closes the panel
  // itself when its run ends.
  if (link.embed && (state.kind === "live" || state.kind === "checking")) return null;

  const live = state.kind === "live";
  const problem = state.kind === "ended" || state.kind === "not_newest" || state.kind === "not_found" || state.kind === "error";
  return (
    <div
      role="status"
      data-testid="twin-link-banner"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-1.5 text-xs ${
        problem ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-primary/30 bg-primary/10 text-foreground"
      }`}
    >
      <span className="flex items-center gap-1.5 font-semibold" title={link.run}>
        <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500 animate-pulse" : problem ? "bg-amber-500" : "bg-zinc-500"}`} />
        <Radio className="h-3.5 w-3.5" />
        <span>{pinMessage(state, link.run)}</span>
      </span>
      <span className="ml-auto flex items-center gap-3">
        {problem && !link.embed ? (
          <button type="button" onClick={followLiveRun} className="underline underline-offset-2 hover:text-foreground">
            Follow the live run instead
          </button>
        ) : null}
        {!link.embed ? (
          // the way back to the twin from a phone: a finger-sized hit area on touch screens, same look
          <a href={twinBackUrl(link.run)} className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline [@media(pointer:coarse)]:-my-2 [@media(pointer:coarse)]:py-2">
            Back to the twin <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </span>
    </div>
  );
}
