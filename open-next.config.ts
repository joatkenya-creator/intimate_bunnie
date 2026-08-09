import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No incremental-cache / queue / tag-cache bindings: those need KV/R2/D1/DO,
// which the free-plan build does not provision. Add them when ISR is needed.
export default defineCloudflareConfig()
