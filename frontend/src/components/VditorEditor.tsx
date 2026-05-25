import { useEffect, useRef } from 'react'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import 'vditor/dist/js/i18n/zh_CN'
import { api } from '../api'
import { useTheme } from '../theme-provider'

type EditorTheme = 'classic' | 'dark'

interface Props {
  value: string
  onChange: (value: string) => void
  articleId?: number
  placeholder?: string
  minHeight?: number
  className?: string
}

const getUploadMarkdown = (file: File, url: string) => {
  if (file.type.startsWith('image/')) {
    return `![${file.name}](${url})`
  }
  return `[${file.name}](${url})`
}

export function VditorEditor({
  value,
  onChange,
  articleId,
  placeholder = '请输入 Markdown 内容...',
  minHeight = 520,
  className,
}: Props) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Vditor | null>(null)
  const onChangeRef = useRef(onChange)
  const initialValueRef = useRef(value)
  const vditorI18n = (window as typeof window & { VditorI18n?: Record<string, string> }).VditorI18n

  const vditorTheme: EditorTheme = theme === 'dark' ? 'dark' : 'classic'

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    initialValueRef.current = value
  }, [value])

  useEffect(() => {
    if (!containerRef.current) return

    // 记录 Vditor 初始化前 <head> 中已有的元素，用于 destroy 后清理
    const headChildrenBefore = new Set(Array.from(document.head.children))

    const editor = new Vditor(containerRef.current, {
      mode: 'ir',
      theme: vditorTheme,
      lang: 'zh_CN',
      i18n: vditorI18n,
      minHeight,
      placeholder,
      cache: {
        enable: false,
      },
      value: initialValueRef.current,
      input: nextValue => {
        onChangeRef.current(nextValue)
      },
      preview: {
        mode: 'editor',
        hljs: {
          enable: true,
          style: vditorTheme === 'dark' ? 'github-dark-dimmed' : 'github',
        },
      },
      upload: {
        multiple: true,
        handler: async files => {
          for (const file of files) {
            try {
              const result = await api.uploadFile(file, articleId)
              editorRef.current?.insertMD(getUploadMarkdown(file, result.url))
            } catch {
              alert(`${file.name} 上传失败`)
            }
          }
          return null
        },
      },
      after() {
        editor.focus()
      },
    })

    editorRef.current = editor

    return () => {
      editor.destroy()
      // 删除 Vditor 注入到 <head> 的 script / link / style 标签
      Array.from(document.head.children).forEach(el => {
        if (!headChildrenBefore.has(el)) el.remove()
      })
      editorRef.current = null
    }
  }, [articleId, minHeight, placeholder, vditorTheme])

  return <div ref={containerRef} className={className} />
}
