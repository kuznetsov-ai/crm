import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12, color: 'var(--text, #111)' }}>
          Что-то сломалось
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary, #666)', marginBottom: 16 }}>
          Страница не смогла отрендериться. Обнови страницу или вернись назад.
        </p>
        <pre style={{
          fontSize: 12,
          background: 'var(--bg-hover, #f5f5f5)',
          padding: 12,
          borderRadius: 6,
          overflow: 'auto',
          maxHeight: 240,
          color: 'var(--text, #111)',
        }}>
          {this.state.error.message}
          {this.state.error.stack ? '\n\n' + this.state.error.stack : ''}
        </pre>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: '8px 16px',
              background: 'var(--accent, #fd7448)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Попробовать ещё раз
          </button>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text, #111)',
              border: '1px solid var(--border, #ddd)',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Обновить страницу
          </button>
        </div>
      </div>
    )
  }
}
