import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Index from "./pages/Index";
import Game from "./pages/Game";
import MultiplayerGame from "./pages/MultiplayerGame";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Dictionary from "./pages/Dictionary";
import Lobby from "./pages/Lobby";
import PuzzleGame from "./pages/PuzzleGame";
import NotFound from "./pages/NotFound";
import Daily from "./pages/Daily";
import DailyChallengePage from "./pages/DailyChallenge";
import { BotProvider } from "./contexts/BotContext";
import { DictionaryProvider } from "./contexts/DictionaryContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeToggle } from "./components/ThemeToggle";
import { NotificationSystem } from "./components/NotificationSystem";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/game" element={<Game />} />
          <Route path="/multiplayer-game/:gameId" element={<ErrorBoundary><MultiplayerGame /></ErrorBoundary>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/puzzle" element={
            <ErrorBoundary>
              <PuzzleGame />
            </ErrorBoundary>
          } />
          <Route path="/daily" element={<Daily />} />
          <Route path="/daily-challenge" element={<DailyChallengePage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

const AppContent = () => {
  const { user } = useAuth()
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center px-4">
            <SidebarTrigger />
            <h2 className="ml-4 text-lg font-semibold">Scrabble Online</h2>
            <div className="ml-auto flex items-center gap-2">
              {!user && (
                <Link to="/auth" className="text-sm underline">
                  Sign In / Register
                </Link>
              )}
              <NotificationSystem />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <AppRoutes />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <DictionaryProvider>
              <BotProvider>
                <AppContent />
              </BotProvider>
            </DictionaryProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App;
