<script lang="ts">
  import { kindOf, suitOf, type TileId } from '../core'

  // Presentational leaf: one physical tile in, one chip out. The face is the tile's
  // mpsz kind — the same notation the engine and the teaching layer speak. The future
  // tile-art ticket replaces this component's internals (kind text → original SVG
  // face); Table and App never move.
  let { id }: { id: TileId } = $props()

  const kind = $derived(kindOf(id))
  const suit = $derived(suitOf(kind))
</script>

<span class="tile suit-{suit}">{kind}</span>

<style>
  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5em;
    padding: 0.3em 0.2em;
    background: #f6f1e4;
    border: 1px solid #c9bfa6;
    border-bottom-width: 3px;
    border-radius: 0.25em;
    font-size: 0.8rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  /* Per-suit face color — legibility for the learner, not semantics. */
  .suit-m {
    color: #a03c2e;
  }
  .suit-p {
    color: #2e5aa0;
  }
  .suit-s {
    color: #2e7d4f;
  }
  .suit-z {
    color: #2b2b2b;
  }
</style>
