import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  ChefHat,
  QrCode,
  UserCog,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrandMark } from '@/components/layout/brand-mark'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { DEMO_LINKS } from '@/config/demo'

type Entry = {
  key: 'reserve' | 'table' | 'waiter' | 'manager'
  to: string
  icon: ReactNode
}

const GUEST: Entry[] = [
  {
    key: 'reserve',
    to: DEMO_LINKS.reserve,
    icon: <CalendarClock className="size-6" aria-hidden />,
  },
  {
    key: 'table',
    to: DEMO_LINKS.table,
    icon: <QrCode className="size-6" aria-hidden />,
  },
]

const STAFF: Entry[] = [
  {
    key: 'waiter',
    to: DEMO_LINKS.staffLogin,
    icon: <ChefHat className="size-6" aria-hidden />,
  },
  {
    key: 'manager',
    to: DEMO_LINKS.staffLogin,
    icon: <UserCog className="size-6" aria-hidden />,
  },
]

// The live demo hub: every "Request a demo" button lands here. Guests open the
// demo restaurant directly; staff go to the sign-in page.
export function DemoPage() {
  const { t } = useTranslation('landing')
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-xl font-normal tracking-tight"
        >
          <BrandMark className="h-8" />
          masapay
        </Link>
        <LanguageSwitcher className="rounded-full bg-transparent" />
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-10">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {t('demoPage.eyebrow')}
        </p>
        <h1 className="mt-4 text-[clamp(2rem,4.6vw,3rem)] font-normal leading-[0.98] tracking-[-0.045em]">
          {t('demoPage.title')}
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground">
          {t('demoPage.body')}
        </p>
        <DemoSection title={t('demoPage.guest')} entries={GUEST} />
        <DemoSection title={t('demoPage.staff')} entries={STAFF} />
        <p className="mt-6 text-sm text-muted-foreground">
          {t('demoPage.staffNote')}
        </p>
      </main>
    </div>
  )
}

function DemoSection({ title, entries }: { title: string; entries: Entry[] }) {
  const { t } = useTranslation('landing')
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-normal tracking-tight">{title}</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link
            key={entry.key}
            to={entry.to}
            className="group flex items-start gap-4 rounded-3xl bg-white p-6 transition-colors hover:bg-black hover:text-white"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-foreground group-hover:bg-white/10 group-hover:text-white">
              {entry.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-lg font-medium">
                {t(`demoPage.entries.${entry.key}.title`)}
                <ArrowRight className="size-4" aria-hidden />
              </span>
              <span className="mt-1 block text-sm text-muted-foreground group-hover:text-white/70">
                {t(`demoPage.entries.${entry.key}.body`)}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
