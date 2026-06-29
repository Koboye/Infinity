'use client';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'secondary'|'ghost'|'danger';
  fullWidth?: boolean; loading?: boolean;
}

const STYLES = {
  primary: 'background:linear-gradient(135deg,#3D6B4F,#5A9A6F);color:white;border:none',
  secondary: 'background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.1)',
  ghost: 'background:transparent;color:rgba(255,255,255,0.7);border:none',
  danger: 'background:rgba(255,69,58,0.15);color:#FF453A;border:1px solid rgba(255,69,58,0.3)',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant='primary', fullWidth, loading, disabled, className, children, style, ...rest }, ref
) {
  return (
    <button ref={ref} disabled={disabled||loading} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, borderRadius:16, padding:'12px 20px', fontSize:14, fontWeight:600, cursor:(disabled||loading)?'not-allowed':'pointer', opacity:(disabled||loading)?0.5:1, width:fullWidth?'100%':undefined, transition:'all 0.15s', ...style }} {...rest}>
      {loading && <span style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />}
      {children}
    </button>
  );
});
