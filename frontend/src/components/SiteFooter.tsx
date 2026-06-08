import { SITE_CONFIG } from '../config/site'

export function SiteFooter() {
  return (
    <footer className="bg-black px-4 py-6 text-center text-sm text-zinc-400">
      <a
        href={SITE_CONFIG.icpUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="transition-colors hover:text-white"
      >
        {SITE_CONFIG.icpNumber}
      </a>
    </footer>
  )
}
