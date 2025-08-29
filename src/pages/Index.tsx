import { PlayButtons } from "@/components/PlayButtons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router-dom"
import { Users, LogIn } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"

const Index = () => {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-4">Welcome to Scrabble Online</h1>
            <p className="text-lg text-muted-foreground">
              The best place to play Scrabble online with advanced analysis
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <PlayButtons />
          </div>

          {/* Multiplayer Section */}
          <div className="max-w-lg mx-auto">
            {user && profile ? (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-6 w-6" />
                    Multiplayer Dashboard
                  </CardTitle>
                  <CardDescription>
                    Manage your online games and find new opponents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/dashboard">
                    <Button className="w-full">
                      Go to Dashboard
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LogIn className="h-6 w-6" />
                    Sign in for Multiplayer
                  </CardTitle>
                  <CardDescription>
                    Create an account to play online
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/auth">
                    <Button className="w-full">
                      Sign In / Register
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
  );
};

export default Index;
