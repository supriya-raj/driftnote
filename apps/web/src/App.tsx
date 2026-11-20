import { createBrowserRouter, RouterProvider } from "react-router";
import { AppShell } from "./layout/AppShell";
import { EmptyState } from "./pages/EmptyState";
import { NotePage } from "./pages/NotePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <EmptyState /> },
      { path: "n/:noteId", element: <NotePage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
