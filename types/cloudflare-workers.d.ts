/// <reference types="@cloudflare/workers-types" />

// Bindings consumed by worker/index.ts. TypeScript merges this declaration
// with the empty `Cloudflare.Env` from @cloudflare/workers-types.
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
  }
}
