#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <memory>
#include <fstream>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

// Quackle headers
#include "game.h"
#include "board.h"
#include "rack.h"
#include "move.h"
#include "generator.h"
#include "player.h"
#include "playerlist.h"
#include "datamanager.h"
#include "alphabetparameters.h"
#include "lexiconparameters.h"
#include "bag.h"
#include "gameparameters.h"
#include "strategyparameters.h"

static std::string arg(int argc, char** argv, const std::string& k, const std::string& d) {
  for (int i=1;i<argc-1;++i) if (std::string(argv[i])==k) return std::string(argv[i+1]);
  return d;
}
static int simsFor(const std::string& d){ if(d=="easy")return 0; if(d=="hard")return 800; return 300; }

// Debug logging function
void debugLog(const std::string& message) {
  std::ofstream debugFile("/tmp/quackle_debug.log", std::ios::app);
  if (debugFile.is_open()) {
    debugFile << "[DEBUG] " << message << std::endl;
    debugFile.close();
  }
  // Also output to stderr for immediate visibility
  std::cerr << "[DEBUG] " << message << std::endl;
}

int main(int argc, char** argv){
  debugLog("=== Quackle Bridge Started (v1.0.4 with correct API) ===");
  
  const std::string lexicon = arg(argc, argv, "--lexicon", "en-enable");
  const std::string lexdir  = arg(argc, argv, "--lexdir",  "/usr/share/quackle/lexica");
  
  debugLog("Lexicon: " + lexicon + ", LexDir: " + lexdir);

  std::ostringstream ss; ss<<std::cin.rdbuf(); std::string input=ss.str();
  debugLog("Input length: " + std::to_string(input.length()));
  debugLog("Input content: " + input.substr(0, 500)); // First 500 chars
  
  json req; try{ req = json::parse(input.empty()?"{}":input); }catch(const std::exception& e){
    debugLog("JSON parse error: " + std::string(e.what()));
    std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"json_parse"})"; return 0;
  }

  try{
    const json jboard = req.value("board", json::object());
    const json jrack  = req.value("rack",  json::array());
    const std::string diff = req.value("difficulty", std::string("medium"));
    const int simulations = simsFor(diff);

    debugLog("Board keys count: " + std::to_string(jboard.size()));
    debugLog("Rack size: " + std::to_string(jrack.size()));
    debugLog("Difficulty: " + diff);

    // Prepare data manager and lexicon
    debugLog("Setting up data manager...");
    
    // Create DataManager instance if it doesn't exist
    if (!QUACKLE_DATAMANAGER_EXISTS) {
      debugLog("Creating DataManager instance...");
      new Quackle::DataManager();
      debugLog("DataManager instance created");
    }
    
    QUACKLE_DATAMANAGER->setAppDataDirectory(lexdir);
    debugLog("App data directory set");
    QUACKLE_DATAMANAGER->setBackupLexicon(lexicon);
    debugLog("Backup lexicon set");
    auto *alphabet = new Quackle::EnglishAlphabetParameters();
    debugLog("Alphabet parameters created");
    QUACKLE_DATAMANAGER->setAlphabetParameters(alphabet);
    debugLog("Alphabet parameters set");
    auto *lexParams = new Quackle::LexiconParameters();
    debugLog("Lexicon parameters created");
    
    debugLog("Finding dictionary file...");
    debugLog("Looking for: " + lexicon + ".dawg");
    debugLog("App data directory: " + lexdir);
    
    // Try to find the file using DataManager first
    std::string dawgFile = QUACKLE_DATAMANAGER->findDataFile("", lexicon + ".dawg");
    debugLog("DataManager dawg file path: '" + dawgFile + "'");
    
    // If DataManager doesn't find it, try direct path
    if (dawgFile.empty()) {
      dawgFile = lexdir + "/" + lexicon + ".dawg";
      debugLog("Trying direct path: " + dawgFile);
    }
    
    debugLog("Final dawg file path: '" + dawgFile + "'");
    
    // Check if file exists before loading
    debugLog("Checking if file exists...");
    std::ifstream file(dawgFile);
    if (!file.good()) {
      debugLog("ERROR: Dawg file does not exist: " + dawgFile);
      throw std::runtime_error("Dawg file not found: " + dawgFile);
    }
    file.close();
    debugLog("File exists and is readable");
    
    debugLog("Loading lexicon...");
    lexParams->loadDawg(dawgFile);
    debugLog("DAWG lexicon loaded successfully");
    
    // Also load GADDAG file if it exists
    std::string gaddagFile = lexdir + "/" + lexicon + ".gaddag";
    debugLog("Looking for GADDAG file: " + gaddagFile);
    std::ifstream gaddagFileCheck(gaddagFile);
    if (gaddagFileCheck.good()) {
        gaddagFileCheck.close();
        debugLog("GADDAG file found, loading...");
        lexParams->loadGaddag(gaddagFile);
        debugLog("GADDAG lexicon loaded successfully");
    } else {
        debugLog("WARNING: GADDAG file not found: " + gaddagFile);
        debugLog("This may cause segmentation faults in move generation");
    }
    
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);
    debugLog("Lexicon parameters set");
    
    debugLog("Data manager setup complete");

    // Build rack
    debugLog("Building rack...");
    Quackle::Rack rr;
    Quackle::LetterString rackString;
    
    // Handle both string and array formats for rack
    if (jrack.is_string()) {
        // If rack is a string like "CAT"
        std::string rackStr = jrack.get<std::string>();
        debugLog("Rack is string: " + rackStr);
        for (char c : rackStr) {
            char ch = std::toupper(c);
            rackString.push_back(ch);
            debugLog("Rack tile: letter='" + std::string(1, c) + "', final='" + std::string(1, ch) + "'");
        }
    } else if (jrack.is_array()) {
        // If rack is an array of tile objects
        for (const auto &tile : jrack) {
            std::string letter = tile.value("letter","?");
            bool isBlank = tile.value("isBlank", false);
            char ch = std::toupper(letter[0]);
            if (isBlank) ch = '?';
            rackString.push_back(ch);
            debugLog("Rack tile: letter='" + letter + "', isBlank=" + std::string(isBlank ? "true" : "false") + ", final='" + std::string(1,ch) + "'");
        }
    } else {
        debugLog("ERROR: Invalid rack format");
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid rack format"})" << std::endl;
        return 1;
    }
    
    rr.setTiles(rackString);
    debugLog("Rack string: " + std::string(rackString.begin(), rackString.end()));

    // Create game position
    debugLog("Creating game position...");
    Quackle::PlayerList players;
    players.push_back( Quackle::Player("A") );
    players.push_back( Quackle::Player("B") );
    Quackle::GamePosition pos(players);
    Quackle::Board &board = pos.underlyingBoardReference();
    board.prepareEmptyBoard();
    pos.setCurrentPlayerRack(rr, false);
    
    // Set up bag for the position
    Quackle::Bag bag;
    pos.setBag(bag);
    debugLog("Bag set for position");
    
    // Set current player to 0 (first player)
    pos.setCurrentPlayer(0);
    debugLog("Current player set to 0");
    
    // Game parameters and strategy parameters are set globally via DataManager
    debugLog("Game parameters and strategy parameters configured via DataManager");
    
    debugLog("Game position created, rack set");

    // Place existing board tiles
    debugLog("Placing existing board tiles...");
    for (auto it = jboard.begin(); it != jboard.end(); ++it) {
      int r = 0, c = 0; char comma;
      std::istringstream sscoord(it.key()); sscoord >> r >> comma >> c;
      // Convert from 1-based coordinates to Quackle's 0-based board
      --r; --c;
      std::string letter = it->value("letter", "?");
      bool isBlank = it->value("isBlank", false);
      char ch = std::toupper(letter[0]);
      if (isBlank) ch = '?';
      
      debugLog("Placing tile at (" + std::to_string(r) + "," + std::to_string(c) + "): letter='" + letter + "', isBlank=" + std::string(isBlank ? "true" : "false") + ", final='" + std::string(1,ch) + "'");
      
      Quackle::LetterString single;
      single.push_back(ch);
      Quackle::Move m = Quackle::Move::createPlaceMove(r, c, false, single);
      board.makeMove(m);
      if (board.letter(r, c) != ch) {
        debugLog("ERROR: Failed to place tile at (" + std::to_string(r) + "," + std::to_string(c) + ")");
        throw std::runtime_error("failed to place existing tile");
      }
    }
    debugLog("Board tiles placed successfully");

    // Generate best move using Quackle's AI
    debugLog("Generating best move...");
    debugLog("Creating generator...");
    Quackle::Generator gen(pos);
    debugLog("Generator created successfully");
    
    // Update cross structures for move generation
    debugLog("Updating cross structures...");
    gen.allCrosses();
    debugLog("Cross structures updated");
    
    // Try to use Quackle's AI properly
    debugLog("Attempting to use Quackle AI...");
    
    try {
        // Use kibitz with appropriate number of simulations based on difficulty
        debugLog("Calling kibitz(" + std::to_string(simulations) + ") for " + diff + " difficulty...");
        gen.kibitz(simulations);
        debugLog("Kibitz completed successfully");
        
        // Get the best move from kibitzList()
        debugLog("Getting best move from kibitzList()...");
        const auto &moves = gen.kibitzList();
        
        Quackle::Move best;
        bool foundValidMove = false;
        
        if (!moves.empty()) {
            best = moves.front(); // First move is the best
            foundValidMove = true;
            debugLog("Found valid move from Quackle AI, score: " + std::to_string(best.score));
        } else {
            debugLog("No moves found in kibitzList, trying fallback strategies");

            // For easy difficulty with 0 simulations, try a minimal simulation
            if (simulations == 0) {
                debugLog("Easy difficulty with 0 simulations, trying minimal kibitz...");
                gen.kibitz(1);
                const auto &fallbackMoves = gen.kibitzList();
                if (!fallbackMoves.empty()) {
                    best = fallbackMoves.front();
                    foundValidMove = true;
                    debugLog("Found move with minimal simulation, score: " + std::to_string(best.score));
                }
            }

            // If still no moves, try to find any possible move by generating all plays
            if (!foundValidMove) {
                debugLog("Trying to generate all possible plays...");
                gen.kibitz(10); // Small number to find at least something
                const auto &allMoves = gen.kibitzList();
                if (!allMoves.empty()) {
                    best = allMoves.front();
                    foundValidMove = true;
                    debugLog("Found move from expanded search, score: " + std::to_string(best.score));
                }
            }

            // Final fallback: pass
            if (!foundValidMove) {
                debugLog("No valid moves found, bot will pass");
                best = Quackle::Move::createPassMove();
                debugLog("Pass move created");
            }
        }
      
        // Convert the move to JSON
        json tiles = json::array();
        json words = json::array();
        
        // Check move type
        if (best.action == Quackle::Move::Pass) {
            debugLog("Move is a pass");
            json response;
            response["tiles"] = json::array();
            response["score"] = 0;
            response["words"] = json::array();
            response["move_type"] = "pass";
            response["engine_fallback"] = !foundValidMove;
            std::cout << response.dump() << std::endl;
        } else if (!best.tiles().empty()) {
          debugLog("Processing place move...");
          
          // Extract tiles from the move
          Quackle::LetterString tilesStr = best.tiles();
          
          // Convert FixedLengthString to std::string by iterating through characters
          std::string tilesString;
          for (size_t i = 0; i < tilesStr.length(); ++i) {
            tilesString += tilesStr[i];
          }
          debugLog("Tiles string: " + tilesString);
          
          // Extract proper tile information from the move
          int startRow = best.startrow;
          int startCol = best.startcol;
          bool isHorizontal = best.horizontal;
          
          debugLog("Move details: startRow=" + std::to_string(startRow) + ", startCol=" + std::to_string(startCol) + ", isHorizontal=" + std::string(isHorizontal ? "true" : "false"));
          
          // Create tile representations with proper coordinates
          for (size_t i = 0; i < tilesStr.length(); ++i) {
            json tileJson;
            tileJson["letter"] = std::string(1, tilesStr[i]);
            tileJson["points"] = 1; // Default points - could be improved with actual tile values
            tileJson["isBlank"] = (tilesStr[i] == '?');
            
            // Calculate proper coordinates based on direction
            if (isHorizontal) {
              tileJson["row"] = startRow;
              tileJson["col"] = startCol + i;
            } else {
              tileJson["row"] = startRow + i;
              tileJson["col"] = startCol;
            }
            
            tiles.push_back(tileJson);
          }
          
          // Extract words formed by this move
          if (!tilesString.empty()) {
            words.push_back(tilesString);
          }
          
          json response;
          response["tiles"] = tiles;
          response["score"] = best.score;
          response["words"] = words;
          response["move_type"] = "play";
          response["engine_fallback"] = !foundValidMove; // True only if we used fallback
          
          std::cout << response.dump() << std::endl;
        } else {
          debugLog("Move is not a place move and not a pass - returning pass");
          json response;
          response["tiles"] = json::array();
          response["score"] = 0;
          response["words"] = json::array();
          response["move_type"] = "pass";
          response["engine_fallback"] = true;
          std::cout << response.dump() << std::endl;
        }
        
    } catch (const std::exception& e) {
      debugLog("Exception during move generation: " + std::string(e.what()));
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":")" << e.what() << R"("})" << std::endl;
    } catch (...) {
      debugLog("Unknown exception during move generation");
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"unknown exception"})" << std::endl;
    }
  }catch(const std::exception& e){
    debugLog("Exception caught: " + std::string(e.what()));
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error",std::string("engine: ")+e.what()}};
    std::cout<<out.dump(); return 0;
  }catch(...){
    debugLog("Unknown exception caught");
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error","engine: unknown"}};
    std::cout<<out.dump(); return 0;
  }
}