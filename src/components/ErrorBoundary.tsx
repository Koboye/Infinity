'use client';
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: (error: Error, reset: () => void) => ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[ErrorBoundary]', error, info); }
  reset = () => this.setState({ error: null });
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:16, padding:32, textAlign:'center' }}>
        <div style={{ fontSize:64 }}>😵</div>
        <h2 style={{ fontSize:20, fontWeight:700 }}>Something went wrong</h2>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', maxWidth:320 }}>{error.message}</p>
        <button onClick={this.reset} style={{ background:'linear-gradient(135deg,#3D6B4F,#5A9A6F)', border:'none', color:'white', borderRadius:16, padding:'12px 24px', fontSize:14, fontWeight:600, cursor:'pointer' }}>Try again</button>
      </div>
    );
  }
}
