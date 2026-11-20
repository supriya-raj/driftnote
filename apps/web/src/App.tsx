import { createBrowserRouter, RouterProvider } from "react-router";
import { HomePage } from "./pages/HomePage";
import { NotePage } from "./pages/NotePage";
import { StorageWarning } from "./storage/StorageWarning";
import { UpdatePrompt } from "./UpdatePrompt";

const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/n/:noteId", element: <NotePage /> },
]);

export function App() {
  return (
    <>
      <UpdatePrompt />
      <StorageWarning />
      <RouterProvider router={router} />
    </>
  );
}
