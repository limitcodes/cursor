import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { PlusIcon, TerminalIcon, XIcon } from '@phosphor-icons/react'

type TerminalTab = {
  id: string
  title: string
  cwd: string
}

type TerminalRuntime = {
  term: Terminal
  fit: FitAddon
}

function App(): React.JSX.Element {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const runtimes = useMemo(() => new Map<string, TerminalRuntime>(), [])
  const containers = useMemo(() => new Map<string, HTMLDivElement>(), [])
  const creating = useRef(false)

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeId) ?? null, [activeId, tabs])

  const fitTerminal = useCallback(
    (id: string) => {
      const runtime = runtimes.get(id)
      if (!runtime) return

      requestAnimationFrame(() => {
        runtime.fit.fit()
        window.api.terminal.resize(id, runtime.term.cols, runtime.term.rows)
      })
    },
    [runtimes]
  )

  const attachTerminal = useCallback(
    (id: string, element: HTMLDivElement | null) => {
      if (!element) {
        containers.delete(id)
        return
      }

      containers.set(id, element)
      const runtime = runtimes.get(id)
      if (!runtime || runtime.term.element) return

      runtime.term.open(element)
      fitTerminal(id)
      runtime.term.focus()
    },
    [containers, fitTerminal, runtimes]
  )

  const createTerminal = useCallback(async () => {
    if (creating.current) return
    creating.current = true

    try {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'bar',
        fontFamily:
          'MesloLGS NF, Symbols Nerd Font Mono, Hack Nerd Font, JetBrainsMono Nerd Font, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.2,
        convertEol: true,
        allowProposedApi: false,
        theme: {
          background: '#181818',
          foreground: '#d7d7d7',
          cursor: '#e4e4e4',
          selectionBackground: '#3a3a3a',
          black: '#181818',
          brightBlack: '#686868',
          red: '#e34671',
          green: '#3fa266',
          yellow: '#f1b467',
          blue: '#81a1c1',
          magenta: '#b48ead',
          cyan: '#82d2ce',
          white: '#e4e4e4'
        }
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.loadAddon(new WebLinksAddon())

      const created = await window.api.terminal.create({ cols: 120, rows: 32 })
      runtimes.set(created.id, { term, fit })

      term.onData((data) => window.api.terminal.write(created.id, data))
      term.onResize(({ cols, rows }) => window.api.terminal.resize(created.id, cols, rows))
      term.onTitleChange((title) => {
        const trimmedTitle = title.trim()
        if (!trimmedTitle) return
        setTabs((current) =>
          current.map((tab) => (tab.id === created.id ? { ...tab, title: trimmedTitle } : tab))
        )
      })

      setTabs((current) => [
        ...current,
        { id: created.id, title: `terminal ${current.length + 1}`, cwd: created.cwd }
      ])
      setActiveId(created.id)
    } finally {
      creating.current = false
    }
  }, [runtimes])

  const closeTerminal = useCallback(
    (id: string) => {
      const index = tabs.findIndex((tab) => tab.id === id)
      const runtime = runtimes.get(id)
      runtime?.term.dispose()
      runtimes.delete(id)
      containers.delete(id)
      window.api.terminal.dispose(id)

      setTabs((current) => current.filter((tab) => tab.id !== id))
      setActiveId((current) => {
        if (current !== id) return current
        const next = tabs[index + 1] ?? tabs[index - 1]
        return next?.id ?? null
      })
    },
    [containers, runtimes, tabs]
  )

  useEffect(() => {
    void createTerminal()
  }, [createTerminal])

  useEffect(() => {
    const removeDataListener = window.api.terminal.onData(({ id, data }) => {
      runtimes.get(id)?.term.write(data)
    })
    const removeExitListener = window.api.terminal.onExit(({ id }) => {
      setTabs((current) => current.filter((tab) => tab.id !== id))
      setActiveId((current) => (current === id ? null : current))
      runtimes.get(id)?.term.dispose()
      runtimes.delete(id)
    })

    return () => {
      removeDataListener()
      removeExitListener()
      for (const [id, runtime] of runtimes) {
        runtime.term.dispose()
        window.api.terminal.dispose(id)
      }
      runtimes.clear()
    }
  }, [runtimes])

  useEffect(() => {
    if (!activeId) return
    fitTerminal(activeId)
    runtimes.get(activeId)?.term.focus()
  }, [activeId, fitTerminal, runtimes])

  const fitActiveTerminal = useEffectEvent(() => {
    if (activeId) fitTerminal(activeId)
  })

  useEffect(() => {
    const onResize = () => fitActiveTerminal()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <main className="app-shell">
      <nav className="terminal-navbar" aria-label="Terminals">
        <div className="terminal-tabs">
          {tabs.map((tab) => (
            <div className={`terminal-tab${tab.id === activeId ? ' is-active' : ''}`} key={tab.id}>
              <button
                className="terminal-tab-main"
                onClick={() => setActiveId(tab.id)}
                title={tab.cwd}
                type="button"
              >
                <TerminalIcon className="terminal-tab-icon" size={16} weight="regular" />
                <span className="terminal-tab-title">{tab.title}</span>
              </button>
              <button
                className="terminal-tab-close"
                onClick={() => closeTerminal(tab.id)}
                type="button"
                aria-label={`Close ${tab.title}`}
              >
                <XIcon size={13} weight="regular" />
              </button>
            </div>
          ))}
        </div>
        <button className="terminal-new" onClick={createTerminal} type="button" aria-label="New terminal">
          <PlusIcon size={14} weight="regular" />
        </button>
      </nav>

      <section className="terminal-stage" aria-label={activeTab?.title ?? 'Terminal'}>
        {tabs.map((tab) => (
          <div
            className={`terminal-container${tab.id === activeId ? ' is-active' : ''}`}
            key={tab.id}
            ref={(element) => attachTerminal(tab.id, element)}
          />
        ))}
      </section>
    </main>
  )
}

export default App
