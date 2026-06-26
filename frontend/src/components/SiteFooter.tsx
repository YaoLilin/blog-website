import { SITE_CONFIG } from '../config/site'

export function SiteFooter() {
  return (
    <footer className="bg-black px-4 py-6 text-center text-sm text-zinc-400">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a
          href={SITE_CONFIG.icpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white"
        >
          {SITE_CONFIG.icpNumber}
        </a>
        <a
          href={SITE_CONFIG.publicSecurityUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
        >
          <img src="/gongan.png" alt="" className="size-4 shrink-0" />
          {SITE_CONFIG.publicSecurityNumber}
        </a>
      </div>
    </footer>
  )
}
