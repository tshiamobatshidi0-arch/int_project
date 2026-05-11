import { useState } from 'react'
import viteLogo from './assets/vite.svg'
import { createBrowserRouter, createRoutesFromElements ,Route,Outlet,RouterProvider } from 'react-router'

function SideBar(){
  return (
    <div className="">
      <h2>Chat App</h2>
      <ul>
        <li>Home</li>
        <li>Profile</li>
        <li>Settings</li>
      </ul>
     <Outlet/>
    </div>
  )
}



function App() {

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<SideBar/>}>
         <Route index element={<h1>Welcome to the chat app</h1>}/>
      </Route>
    )
  )

  return <RouterProvider router={router}/>
}
export default App
