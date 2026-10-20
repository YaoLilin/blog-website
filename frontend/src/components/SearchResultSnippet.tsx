import { getSearchSnippet, searchHighlightClass, type SearchSnippetPart } from '../lib/searchSnippet'

export function SearchSnippetText({ parts }: { parts: SearchSnippetPart[] }) {
  return parts.map((part, index) => part.highlighted ? (
    <mark key={index} className={searchHighlightClass}>{part.text}</mark>
  ) : part.text)
}

export function SearchResultSnippet({ content, keyword }: { content: string; keyword: string }) {
  const parts = getSearchSnippet(content, keyword)
  if (parts.length === 0) return null

  return (
    <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400 break-words">
      <SearchSnippetText parts={parts} />
    </p>
  )
}
