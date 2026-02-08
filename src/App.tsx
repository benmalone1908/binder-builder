import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import SetsIndex from "./pages/SetsIndex";
import SetDetail from "./pages/SetDetail";
import CardSearch from "./pages/CardSearch";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <DashboardLayout>
              <SetsIndex />
            </DashboardLayout>
          }
        />
        <Route
          path="/sets/:id"
          element={
            <DashboardLayout>
              <SetDetail />
            </DashboardLayout>
          }
        />
        <Route
          path="/search"
          element={
            <DashboardLayout>
              <CardSearch />
            </DashboardLayout>
          }
        />
        <Route
          path="/admin"
          element={
            <DashboardLayout>
              <Admin />
            </DashboardLayout>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
