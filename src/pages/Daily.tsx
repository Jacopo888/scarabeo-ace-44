import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Trophy, Users, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDictionary } from '@/contexts/DictionaryContext';
import { generateLocal15x15Puzzle } from '@/utils/puzzleGenerator15x15';
import { DailyPuzzle, DailyScore, DailyLeaderboardEntry } from '@/types/daily';
import type { Tile, PlacedTile } from '@/types/game';
import { toast } from 'sonner';

const getTodayNumber = (): number => {
  const today = new Date();
  const utc = new Date(today.getTime() + today.getTimezoneOffset() * 60000);
  return utc.getFullYear() * 10000 + (utc.getMonth() + 1) * 100 + utc.getDate();
};

const formatDateFromNumber = (yyyymmdd: number): string => {
  const str = yyyymmdd.toString();
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const day = str.slice(6, 8);
  return `${year}-${month}-${day}`;
};

const Daily = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isValidWord, isLoaded: isDictionaryLoaded } = useDictionary();
  const [dailyPuzzle, setDailyPuzzle] = useState<DailyPuzzle | null>(null);
  const [leaderboard, setLeaderboard] = useState<DailyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [userScore, setUserScore] = useState<number | null>(null);

  const todayNumber = getTodayNumber();

  useEffect(() => {
    loadDailyPuzzle();
    loadLeaderboard();
    checkIfPlayedToday();
  }, [user]);

  const loadDailyPuzzle = async () => {
    try {
      // Try to fetch today's puzzle
      const { data: existingPuzzle, error } = await supabase
        .from('daily_puzzles')
        .select('*')
        .eq('yyyymmdd', todayNumber)
        .single();

      if (existingPuzzle) {
        setDailyPuzzle(existingPuzzle as unknown as DailyPuzzle);
      } else if (error?.code === 'PGRST116') {
        // No puzzle exists, create one
        await createTodaysPuzzle();
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Error loading daily puzzle:', error);
      toast.error('Failed to load daily puzzle');
    } finally {
      setLoading(false);
    }
  };

  const createTodaysPuzzle = async () => {
    try {
      // Generate a complex puzzle with 8 simulation turns for more challenging gameplay
      const puzzle = generateLocal15x15Puzzle(isValidWord, isDictionaryLoaded, false, 8);
      const bestScore = puzzle.topMoves[0]?.score || 50;

      const newPuzzle = {
        yyyymmdd: todayNumber,
        board: puzzle.board as any,
        rack: puzzle.rack as any,
        best_score: bestScore,
      };

      const { data, error } = await supabase
        .from('daily_puzzles')
        .insert(newPuzzle)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Conflict - another user created it, fetch the existing one
          await loadDailyPuzzle();
          return;
        }
        throw error;
      }

      setDailyPuzzle(data as unknown as DailyPuzzle);
      toast.success('New daily puzzle generated!');
    } catch (error) {
      console.error('Error creating daily puzzle:', error);
      toast.error('Failed to create daily puzzle');
    }
  };

  const loadLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_scores')
        .select('user_id, score, created_at')
        .eq('yyyymmdd', todayNumber)
        .order('score', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const checkIfPlayedToday = async () => {
    if (!user) {
      // Check localStorage for anonymous users
      const localKey = `daily:${todayNumber}:played`;
      const played = localStorage.getItem(localKey);
      if (played) {
        setHasPlayedToday(true);
        setUserScore(parseInt(localStorage.getItem(`daily:${todayNumber}:score`) || '0'));
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_scores')
        .select('score')
        .eq('yyyymmdd', todayNumber)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setHasPlayedToday(true);
        setUserScore(data.score);
      }
    } catch (error) {
      // User hasn't played today, which is fine
    }
  };

  const handlePlayDaily = () => {
    if (!dailyPuzzle) return;
    // Store the daily puzzle in sessionStorage so PuzzleGame can use it
    sessionStorage.setItem('daily-puzzle', JSON.stringify(dailyPuzzle));
    navigate('/puzzle?daily=true');
  };

  const handleShare = async () => {
    if (userScore === null) return;
    const text = `Daily Scrabble ${formatDateFromNumber(todayNumber)}: ${userScore} points\n\nPlay at: ${window.location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Results copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!dailyPuzzle) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Daily Puzzle
            </CardTitle>
            <CardDescription>
              Failed to load today's puzzle. Please try again later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Daily Puzzle Challenge</h1>
        <p className="text-muted-foreground">
          {formatDateFromNumber(todayNumber)} • One puzzle per day
        </p>
      </div>

      {/* Main Puzzle Card */}
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Today's Challenge
          </CardTitle>
          <CardDescription>
            Best score to beat: <strong>{dailyPuzzle.best_score} points</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasPlayedToday ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Challenge yourself with today's puzzle! Find as many high-scoring words as possible.
              </p>
              <Button 
                size="lg" 
                onClick={handlePlayDaily}
                className="w-full sm:w-auto"
              >
                <Play className="h-4 w-4 mr-2" />
                Play Daily Puzzle
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h3 className="font-semibold text-green-700 dark:text-green-300">
                  Completed! 🎉
                </h3>
                <p className="text-green-600 dark:text-green-400">
                  Your score: <strong>{userScore} points</strong>
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleShare} variant="outline">
                  Share Results
                </Button>
                <Button onClick={handlePlayDaily} variant="outline">
                  <Play className="h-4 w-4 mr-2" />
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Today's Leaderboard
          </CardTitle>
          <CardDescription>
            Top players for {formatDateFromNumber(todayNumber)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    entry.user_id === user?.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      index === 2 ? 'text-amber-600' : ''
                    }`}>
                      #{index + 1}
                    </span>
                    <span className="font-medium">
                      {entry.user_id === user?.id ? 'You' : 
                       entry.user_id.startsWith('anon') ? 'Anonymous' : 
                       entry.user_id}
                    </span>
                  </div>
                  <span className="font-bold">
                    {entry.score} points
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No scores yet today. Be the first to play!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Daily;
