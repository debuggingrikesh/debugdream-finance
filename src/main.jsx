import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Apply saved theme before first render so there's no dark→light flash
if (localStorage.getItem('dd-theme') === 'light') {
  document.documentElement.classList.add('light')
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
