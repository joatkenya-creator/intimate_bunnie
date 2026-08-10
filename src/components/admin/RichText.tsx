'use client'

import { useEffect, useRef, useState } from 'react'

// A rich text editor in 90 lines. `contenteditable` plus `document.execCommand`
// is the browser's own editor; a package would be 100–300 kB to add features a
// product description does not need.
//
// ponytail: execCommand is deprecated-but-universal. Nothing has replaced it,
// and every browser still implements it. If it is ever removed, the upgrade is
// to swap this one component for a library — no page that uses it changes,
// because the contract is "a hidden input holding HTML".

const COMMANDS: { label: string; title: string; command: string; value?: string }[] = [
  { label: 'B', title: 'Bold', command: 'bold' },
  { label: 'I', title: 'Italic', command: 'italic' },
  { label: 'H2', title: 'Heading', command: 'formatBlock', value: 'h2' },
  { label: 'H3', title: 'Subheading', command: 'formatBlock', value: 'h3' },
  { label: '¶', title: 'Paragraph', command: 'formatBlock', value: 'p' },
  { label: '“”', title: 'Quote', command: 'formatBlock', value: 'blockquote' },
  { label: '•', title: 'Bulleted list', command: 'insertUnorderedList' },
  { label: '1.', title: 'Numbered list', command: 'insertOrderedList' },
]

export function RichText({
  name,
  defaultValue = '',
  label = 'Body',
  rows = 14,
}: {
  name: string
  defaultValue?: string
  label?: string
  rows?: number
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState(defaultValue)
  const [source, setSource] = useState(false)

  // Written once, imperatively. Letting React own the innerHTML would move the
  // caret to the start of the document on every keystroke.
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== defaultValue) editor.current.innerHTML = defaultValue
  }, [defaultValue])

  function exec(command: string, value?: string) {
    editor.current?.focus()
    document.execCommand(command, false, value)
    setHtml(editor.current?.innerHTML ?? '')
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="admin-label" id={`${name}-label`}>
          {label}
        </span>
        <button type="button" className="admin-btn admin-btn-ghost mb-1 px-2 py-0.5 text-xs" onClick={() => setSource((s) => !s)}>
          {source ? 'Rich text' : 'HTML'}
        </button>
      </div>

      <input type="hidden" name={name} value={html} />

      {source ? (
        <textarea
          rows={rows}
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          aria-labelledby={`${name}-label`}
          className="admin-field font-mono text-xs"
        />
      ) : (
        <div className="admin-panel overflow-hidden">
          <div className="flex flex-wrap gap-1 border-b border-[var(--admin-line)] p-1.5" role="toolbar" aria-label="Formatting">
            {COMMANDS.map((item) => (
              <button
                key={item.title}
                type="button"
                title={item.title}
                aria-label={item.title}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => exec(item.command, item.value)}
                className="admin-btn admin-btn-ghost min-w-8 px-2 py-1 text-xs"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              title="Link"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const url = window.prompt('Link URL')
                if (url) exec('createLink', url)
              }}
              className="admin-btn admin-btn-ghost px-2 py-1 text-xs"
            >
              Link
            </button>
            <button
              type="button"
              title="Remove formatting"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => exec('removeFormat')}
              className="admin-btn admin-btn-ghost ml-auto px-2 py-1 text-xs"
            >
              Clear
            </button>
          </div>

          <div
            ref={editor}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-labelledby={`${name}-label`}
            onInput={(event) => setHtml((event.target as HTMLDivElement).innerHTML)}
            // Paste as plain text: pasting from Word otherwise drags in a
            // stylesheet's worth of inline junk that the sanitiser then strips,
            // leaving the author wondering where their formatting went.
            onPaste={(event) => {
              event.preventDefault()
              document.execCommand('insertText', false, event.clipboardData.getData('text/plain'))
            }}
            style={{ minHeight: `${rows * 1.5}rem` }}
            className="prose-admin max-w-none overflow-y-auto p-3 text-sm leading-relaxed outline-none"
          />
        </div>
      )}
      <p className="mt-1 text-xs text-[var(--admin-muted)]">
        HTML is sanitised on save — scripts, iframes, and event handlers are removed.
      </p>
    </div>
  )
}
