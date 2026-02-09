import { ReactNode, useState } from "react";
import { NavLink } from "react-router-dom";
import { Library, Menu, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
          sidebarOpen ? "w-56" : "w-14"
        )}
      >
        <div className="flex h-[106px] items-center border-b px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          <NavLink
            to="/"
            title="My Sets"
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                sidebarOpen ? "gap-3 px-3" : "justify-center px-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Library className="h-4 w-4 shrink-0" />
            {sidebarOpen && "My Sets"}
          </NavLink>
          <NavLink
            to="/search"
            title="Card Search"
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                sidebarOpen ? "gap-3 px-3" : "justify-center px-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Search className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Card Search"}
          </NavLink>
          <NavLink
            to="/admin"
            title="Admin"
            className={({ isActive }) =>
              cn(
                "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                sidebarOpen ? "gap-3 px-3" : "justify-center px-2",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Admin"}
          </NavLink>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[106px] items-center border-b px-4">
          <div className="flex items-end">
            <img src="/image2.png" alt="Bindered mascot" style={{ height: '80px' }} />
            <img src="/image.png" alt="Bindered logo" style={{ height: '75px' }} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
