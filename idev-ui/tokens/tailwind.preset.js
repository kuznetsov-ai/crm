/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        accent:           'var(--accent)',
        'accent-hover':   'var(--accent-hover)',
        'accent-soft':    'var(--accent-soft)',
        success:          'var(--success)',
        'success-soft':   'var(--success-soft)',
        warning:          'var(--warning)',
        'warning-soft':   'var(--warning-soft)',
        danger:           'var(--danger)',
        'danger-soft':    'var(--danger-soft)',
        info:             'var(--info)',
        'info-soft':      'var(--info-soft)',
        bg:               'var(--bg)',
        surface:          'var(--surface)',
        'surface-2':      'var(--surface-2)',
        border:           'var(--border)',
        text:             'var(--text)',
        'text-muted':     'var(--text-muted)',
        'text-subtle':    'var(--text-subtle)',
      },
      fontFamily: {
        brand: 'var(--font-brand)',
        body:  'var(--font-body)',
      },
      borderRadius: {
        lg:   'var(--r-lg)',
        md:   'var(--r-md)',
        sm:   'var(--r-sm)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
};
