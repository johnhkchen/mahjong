<script lang="ts">
  import type { WindowOutcome } from './drive'
  import { callTerm, windTerm } from './dictionary.svelte'

  // The E-011 outcome notice (T-011-02-01): pure input wiring like RiichiPrompt —
  // no buttons, no decision, just naming what already happened. `outcome` is
  // drive.ts's windowOutcome result, always non-null at the call site (the owner's
  // `{#if notice !== null}` guard). The sentence shape ("called"/"was outranked")
  // stays plain English scaffolding in both terminologies (dictionary.svelte.ts's
  // own Decision 2); only the seat name and the two call names route through
  // windTerm/callTerm.
  let { outcome }: { outcome: WindowOutcome } = $props()
</script>

<p class="notice" role="status">
  <span aria-label="winner">{windTerm(outcome.winner)}</span> called
  <span aria-label="winning call">{callTerm(outcome.winnerType)}</span>
  — your <span aria-label="your call">{callTerm(outcome.playerType)}</span> was outranked
</p>

<style>
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    column-gap: 0.3rem;
    margin: 0;
    padding: 0.5rem 0.9rem;
    background: #124534;
    border: 1px solid #2e7d4f;
    border-radius: 0.75rem;
    color: #eaf3ee;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    text-align: center;
  }

  .notice span {
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
