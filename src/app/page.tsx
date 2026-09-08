import { redirect } from 'next/navigation'

/**
 * The product starts at /analyze now — there is no separate marketing
 * homepage in the active flow. `Landing`/`Story` are left in place under
 * `@/marketing` in case they're useful again later; they're just no longer
 * reachable from `/`.
 */
export default function Home() {
  redirect('/analyze')
}
