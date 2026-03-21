import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '16px',
          border: '1px solid var(--c-stop)',
          borderRadius: '6px',
          color: 'var(--c-stop)',
          fontFamily: 'var(--c-font-mono)',
          fontSize: '12px',
        }}>
          {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
