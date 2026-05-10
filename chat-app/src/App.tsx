import { useState } from 'react'
import viteLogo from './assets/vite.svg'
import { createBrowserRouter, createRoutesFromElements ,Route,Router,RouterProvider } from 'react-router'


function App() {

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<h1>Welcom to the chat app</h1>}/>
    )
  )

  return <RouterProvider router={router}/>
}
export default App
