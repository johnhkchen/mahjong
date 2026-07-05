<script lang="ts">
  import type { IssueLink } from './drive'
  import { term } from './dictionary.svelte'

  // The reporter's half (T-013-02-01, E-013): pure input wiring like every other
  // console prompt, computation-free — `report`/`issueLink` are drive.ts's own
  // buildReportText/buildIssueUrl output, assembled by App.svelte from state this
  // component never touches directly. The dialog itself is the FIRST true modal in
  // this app: a native <dialog> driven by showModal()/close() rather than a manual
  // overlay, so background inertness, focus-trapping, and Escape-to-dismiss are the
  // platform's job, not this file's (design.md Decision 1). App.svelte additionally
  // guards its own tap/claim/pass/win/riichi handlers on `reportOpen` (Decision 8) —
  // belt-and-suspenders, and the thing this app's own tests can actually observe,
  // since jsdom doesn't model <dialog> top-layer inertness.
  let {
    open,
    message = '',
    report,
    issueLink,
    onmessage,
    onclose,
  }: {
    open: boolean
    message?: string
    report: string
    issueLink: IssueLink
    onmessage?: (text: string) => void
    onclose?: () => void
  } = $props()

  let dialogEl: HTMLDialogElement | undefined = $state()

  // Follows `open` imperatively — <dialog> has no declarative "open as modal" prop;
  // showModal()/close() are the only APIs that put it in the top layer versus merely
  // toggling the `open` attribute (which would render it in-flow, not modal).
  $effect(() => {
    if (!dialogEl) return
    if (open && !dialogEl.open) dialogEl.showModal()
    else if (!open && dialogEl.open) dialogEl.close()
  })

  // The copy confirmation's own readable beat — same "set true, clear after a fixed
  // duration" shape as App.svelte's own notice-clearing effect, scoped locally since
  // nothing outside this component ever needs to know a copy just happened.
  const COPIED_DURATION_MS = 1500
  let copied = $state(false)

  async function copyReport() {
    await navigator.clipboard.writeText(report)
    copied = true
    setTimeout(() => {
      copied = false
    }, COPIED_DURATION_MS)
  }
</script>

<dialog
  bind:this={dialogEl}
  aria-label="report a bug"
  onclose={() => onclose?.()}
>
  <form method="dialog" class="report">
    <h2>{term('reportBug')}</h2>
    <label class="field">
      <span>{term('reportMessage')}</span>
      <textarea
        aria-label={term('reportMessage')}
        placeholder={term('reportMessage')}
        value={message}
        oninput={(e) => onmessage?.(e.currentTarget.value)}
      ></textarea>
    </label>
    <pre aria-label="report preview">{report}</pre>
    <div class="actions">
      <button type="button" class="copy" aria-label={term('copyReport')} onclick={copyReport}>
        {copied ? term('reportCopied') : term('copyReport')}
      </button>
      <a class="issue" aria-label={term('openIssue')} href={issueLink.url} target="_blank" rel="noopener">
        {term('openIssue')}
      </a>
    </div>
    {#if issueLink.clipboardFirst}
      <p class="clipboard-first-note">
        This report is long — copy it above, then paste it into the opened issue.
      </p>
    {/if}
    <button type="submit" formmethod="dialog" class="close" aria-label="close">close</button>
  </form>
</dialog>

<style>
  dialog {
    padding: 0;
    border: 1px solid #2e7d4f;
    border-radius: 0.75rem;
    background: #124534;
    color: #eaf3ee;
    max-width: 24rem;
    width: calc(100vw - 2rem);
  }

  dialog::backdrop {
    background: rgba(16, 36, 27, 0.72);
  }

  .report {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
    font: inherit;
  }

  h2 {
    margin: 0;
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #a8c7b8;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #a8c7b8;
  }

  textarea {
    font: inherit;
    font-size: 0.85rem;
    text-transform: none;
    letter-spacing: normal;
    color: #eaf3ee;
    background: #0d2e22;
    border: 1px solid #3d5c4c;
    border-radius: 0.5rem;
    padding: 0.5rem;
    min-height: 4rem;
    resize: vertical;
  }

  pre {
    margin: 0;
    max-height: 10rem;
    overflow: auto;
    padding: 0.5rem;
    background: #0d2e22;
    border: 1px solid #3d5c4c;
    border-radius: 0.5rem;
    font-size: 0.7rem;
    white-space: pre-wrap;
    word-break: break-word;
    color: #a8c7b8;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .copy,
  .issue,
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.75rem;
    padding: 0.4rem 0.8rem;
    background: #1e6b4e;
    border: 1px solid #2e7d4f;
    border-radius: 0.5rem;
    color: #eaf3ee;
    font: inherit;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    text-decoration: none;
    touch-action: manipulation;
  }

  .close {
    background: none;
    font-weight: 400;
    align-self: center;
  }

  .clipboard-first-note {
    margin: 0;
    font-size: 0.75rem;
    color: #a8c7b8;
  }
</style>
