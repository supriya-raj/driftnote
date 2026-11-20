import { createBrowserRouter, RouterProvider } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotePage } from "./pages/NotePage";

const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/n/:noteId", element: <NotePage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
