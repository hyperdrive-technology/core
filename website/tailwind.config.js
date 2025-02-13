/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './content/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './node_modules/@fumadocs/ui/**/*.{js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@fumadocs/ui/styles')],
};
