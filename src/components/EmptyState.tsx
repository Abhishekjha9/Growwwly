import Link from 'next/link'
import { Button, Label } from '@/components/primitives'

export function EmptyState({
  title = 'No analysis yet',
  body = 'Run an analysis to see your product, customer and growth signals here.',
}: {
  title?: string
  body?: string
}) {
  return (
    <div className="flex flex-col items-start border-t border-hairline pt-10">
      <Label>Nothing here yet</Label>
      <h1 className="t-h1 mt-4">{title}</h1>
      <p className="t-body mt-3 max-w-[54ch]">{body}</p>
      <Link href="/analyze" className="mt-7">
        <Button variant="primary" size="lg">
          Analyze a product
        </Button>
      </Link>
    </div>
  )
}
