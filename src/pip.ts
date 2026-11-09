// Document Picture-in-Picture. Chrome과 Edge에서만 되고, 안 되면 작은 별도 창으로 대신한다.

interface DocumentPip {
  requestWindow: (options: { width: number; height: number }) => Promise<Window>
}

export interface PipHandle {
  win: Window
  container: HTMLElement
}

export function pipSupported(): boolean {
  return Boolean((window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture)
}

export async function openPip(width = 420, height = 640): Promise<PipHandle | null> {
  const dpip = (window as unknown as { documentPictureInPicture?: DocumentPip }).documentPictureInPicture
  if (!dpip) return null
  const win = await dpip.requestWindow({ width, height })
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n')
      const style = win.document.createElement('style')
      style.textContent = css
      win.document.head.appendChild(style)
    } catch {
      const href = (sheet as CSSStyleSheet).href
      if (href) {
        const link = win.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = href
        win.document.head.appendChild(link)
      }
    }
  }
  win.document.body.style.margin = '0'
  win.document.body.style.background = '#f4f6f8'
  const container = win.document.createElement('div')
  container.className = 'companion-panel'
  win.document.body.appendChild(container)
  return { win, container }
}
