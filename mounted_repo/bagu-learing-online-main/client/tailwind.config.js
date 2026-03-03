/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ✅ 关键配置：开启手动 class 切换模式
  darkMode: 'class', 
  theme: {
    extend: {},
  },
  plugins: [],
}