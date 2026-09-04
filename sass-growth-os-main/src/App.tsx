import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'motion/react'
import AppShell from '@/components/AppShell'
import { useReducedMotion } from '@/lib/motion'

const Landing = lazy(() => import('@/marketing/Landing'))
const Analysis = lazy(() => import('@/screens/Analysis'))
const Overview = lazy(() => import('@/screens/Overview'))
const Product = lazy(() => import('@/screens/Product'))
const Website = lazy(() => import('@/screens/Website'))
const Seo = lazy(() => import('@/screens/SEO'))
const Acquisition = lazy(() => import('@/screens/Acquisition'))
const Opportunities = lazy(() => import('@/screens/Opportunities'))
const Plan = lazy(() => import('@/screens/Plan'))
const Experiments = lazy(() => import('@/screens/Experiments'))
const Analytics = lazy(() => import('@/screens/Analytics'))
const Settings = lazy(() => import('@/screens/Settings'))

/** Route changes start at the top. Nothing is more disorienting than not. */
function ScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  const reduced = useReducedMotion()

  return (
    // The backstop, not the mechanism. Components still ask `useReducedMotion`
    // and choose what to do — usually to arrive rather than to travel. But
    // layout and spring animations are driven in JS, where the CSS override in
    // styles.css cannot reach them, so anything that forgets to ask is caught
    // here instead of shipping motion at a user who asked for none.
    // Driven by the hook rather than by `"user"`, because the hook already
    // folds in the in-app override — a user who has turned motion back on
    // despite an OS-level preference should get it.
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <ScrollReset />
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/analyze" element={<Analysis />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Overview />} />
              <Route path="product" element={<Product />} />
              <Route path="website" element={<Website />} />
              <Route path="seo" element={<Seo />} />
              <Route path="acquisition" element={<Acquisition />} />
              <Route path="opportunities" element={<Opportunities />} />
              <Route path="plan" element={<Plan />} />
              <Route path="experiments" element={<Experiments />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </AnimatePresence>
      </Suspense>
    </MotionConfig>
  )
}
