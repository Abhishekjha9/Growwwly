/**
 * Product — the model's reading of what you're building and who it's for.
 *
 * Everything on this page is AI interpretation of what you typed in the
 * form, not a measurement — every row says so.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal, SignalBar } from '@/components/primitives'
import { ProfileList, ProfileRow } from '@/components/analyze/ProfileRow'
import { useAnalysis } from '@/lib/analysis-store'

export default function ProductPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { product, customer, problem } = result.productIntelligence

  return (
    <div className="max-w-[880px] pb-4">
      <Reveal>
        <header className="mb-14 lg:mb-20">
          <Label className="mb-4">Product intelligence</Label>
          <h1 className="t-h1">{product.name}</h1>
          <p className="t-body mt-5 max-w-[64ch]">
            Read from what you told us about {product.name}. Most of this is interpretation, not
            measurement — nothing here is a guarantee.
          </p>
        </header>
      </Reveal>

      <Reveal>
        <section aria-labelledby="sec-product">
          <h2 id="sec-product" className="t-label mb-3">
            The product
          </h2>
          <div>
            <ProfileRow label="Category" first>
              {product.category}
            </ProfileRow>
            <ProfileRow label="Primary use case">{product.primaryUseCase}</ProfileRow>
            <ProfileRow label="Secondary use cases">
              <ProfileList items={product.secondaryUseCases} />
            </ProfileRow>
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16 lg:mt-24">
        <section aria-labelledby="sec-customer">
          <h2 id="sec-customer" className="t-label mb-3">
            Who it&apos;s for
          </h2>
          <div>
            <ProfileRow label="Primary customer" first>
              {customer.primaryCustomer}
            </ProfileRow>
            <ProfileRow label="Buyer">{customer.buyer}</ProfileRow>
            <ProfileRow label="User">{customer.user}</ProfileRow>
            <ProfileRow label="Ideal customer profile" prose>
              {customer.idealCustomerProfile}
            </ProfileRow>
            <ProfileRow label="Pain points">
              <ProfileList items={customer.painPoints} />
            </ProfileRow>
            <ProfileRow label="Jobs to be done">
              <ProfileList items={customer.jobsToBeDone} />
            </ProfileRow>
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-16 lg:mt-24">
        <section aria-labelledby="sec-problem">
          <h2 id="sec-problem" className="t-label mb-3">
            The problem
          </h2>
          <p className="t-meta mb-7 max-w-[58ch]">{problem.primaryProblem}</p>

          <div className="grid grid-cols-1 gap-x-10 gap-y-1 sm:grid-cols-2">
            <SignalMini label="Pain severity" value={problem.painSeverity} />
            <SignalMini label="Urgency" value={problem.urgency} />
            <SignalMini label="Frequency" value={problem.frequency} />
            <SignalMini label="Willingness to pay" value={problem.willingnessToPay} />
          </div>
        </section>
      </Reveal>
    </div>
  )
}

function SignalMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-hairline py-5">
      <div className="flex items-baseline justify-between">
        <span className="t-meta">{label}</span>
        <span className="tnum text-[14px] font-[550] text-ink">{value}</span>
      </div>
      <SignalBar value={value} className="mt-3" />
    </div>
  )
}
