/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				primary: {
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
				},
			},
		},
	},
	plugins: [require('daisyui')],
	daisyui: {
		themes: [
			{
				light: {
					primary: '#3b82f6',
					secondary: '#64748b',
					accent: '#f59e0b',
					neutral: '#1f2937',
					'base-100': '#ffffff',
					'base-200': '#f8fafc',
					'base-300': '#e2e8f0',
					info: '#0ea5e9',
					success: '#10b981',
					warning: '#f59e0b',
					error: '#ef4444',
				},
			},
			{
				dark: {
					primary: '#60a5fa',
					secondary: '#94a3b8',
					accent: '#fbbf24',
					neutral: '#374151',
					'base-100': '#1f2937',
					'base-200': '#111827',
					'base-300': '#0f172a',
					info: '#0ea5e9',
					success: '#10b981',
					warning: '#f59e0b',
					error: '#ef4444',
				},
			},
		],
		darkTheme: 'dark',
		base: true,
		styled: true,
		utils: true,
		rtl: false,
		prefix: '',
		logs: true,
	},
}
