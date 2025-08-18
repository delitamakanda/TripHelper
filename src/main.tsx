import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Post from './Post.tsx';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
    },
    {
        path: ':permalink',
        element: <Post />,
    }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
