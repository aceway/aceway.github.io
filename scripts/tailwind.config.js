/** Mirrors the inline tailwind.config that the Play CDN used to consume.
 *  Compiled to assets/tailwind.css by scripts/build-css.sh. */
module.exports = {
  content: [
    './index.html',
    './detail.html',
    './404.html',
    './apps/**/*.html'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      colors: {
        sciDark: '#0f172a',
        sciLight: '#f8fafc',
        neonBlue: '#3b82f6',
        neonPurple: '#a855f7',
        neonTeal: '#14b8a6'
      },
      animation: {
        blob: 'blob 7s infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards'
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' }
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  }
};
