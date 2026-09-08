/**
 * Product — the model's reading of what you're building and who it's for.
 *
 * Everything on this page is AI interpretation of what you typed in the
 * form, not a measurement — every row says so.
 */

'use client'

import { EmptyState } from '@/components/EmptyState'
import { Label, Reveal } from '@/components/primitives'
import { ProfileList, ProfileRow } from '@/components/analyze/ProfileRow'
import { GrowthProfile } from '@/components/analyze/GrowthProfile'
import { useAnalysis } from '@/lib/analysis-store'

export default function ProductPage() {
  const { result } = useAnalysis()
  if (!result) return <EmptyState />

  const { product, customer, problem, productFitSignals } = result.productIntelligence

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
          <h2 id="sec-product" className="t-h1 mb-1">
            Product
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
          <h2 id="sec-customer" className="t-h1 mb-1">
            Customer
          </h2>
          <div>
            <ProfileRow label="Primary customer" first>
              {customer.primaryCustomer}
            </ProfileRow>

            {/* User and buyer read together — often different people, and
                the relationship between them matters more than either
                value alone. */}
            <div className="grid grid-cols-1 gap-y-6 border-t border-hairline py-7 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-6 sm:py-8">
              <div>
                <Label>User</Label>
                <p className="t-h3 mt-2">{customer.user}</p>
              </div>
              <span aria-hidden className="hidden text-[15px] text-ghost sm:block">
                →
              </span>
              <div>
                <Label>Buyer</Label>
                <p className="t-h3 mt-2">{customer.buyer}</p>
              </div>
            </div>

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
          <h2 id="sec-problem" className="t-h1 mb-1">
            Problem
          </h2>
          <p className="t-body mt-4 mb-7 max-w-[58ch] text-muted">{problem.primaryProblem}</p>

          <Label className="mb-4">Pain profile</Label>
          <GrowthProfile
            groups={[
              {
                signals: [
                  { label: 'Pain severity', value: problem.painSeverity },
                  { label: 'Urgency', value: problem.urgency },
                  { label: 'Frequency', value: problem.frequency },
                  { label: 'Willingness to pay', value: problem.willingnessToPay },
                ],
              },
            ]}
          />
        </section>
      </Reveal>

      <Reveal className="mt-16 lg:mt-24">
        <section aria-labelledby="sec-fit">
          <h2 id="sec-fit" className="t-h1 mb-1">
            Product fit
          </h2>
          <p className="t-body mt-4 mb-7 max-w-[58ch] text-muted">
            How well {product.name} maps to different kinds of audiences and buying behavior.
          </p>

          <GrowthProfile
            groups={[
              {
                signals: [
                  { label: 'Technical audience fit', value: productFitSignals.technicalAudienceFit },
                  { label: 'Visual audience fit', value: productFitSignals.visualAudienceFit },
                  { label: 'Community audience fit', value: productFitSignals.communityAudienceFit },
                  { label: 'Search-driven problem', value: productFitSignals.searchDrivenProblem },
                  {
                    label: 'Impulse purchase potential',
                    value: productFitSignals.impulsePurchasePotential,
                  },
                  { label: 'Sales-led potential', value: productFitSignals.salesLedPotential },
                ],
              },
            ]}
          />
        </section>
      </Reveal>
    </div>
  )
}
