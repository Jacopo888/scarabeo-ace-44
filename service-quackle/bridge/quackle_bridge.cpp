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
  debugLog("=== Quackle Bridge Started ===");
  
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
    (void)diff; // difficulty currently unused

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
    debugLog("Lexicon loaded successfully");
    
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);
    debugLog("Lexicon parameters set");
    
    debugLog("Data manager setup complete");

    // Build rack
    debugLog("Building rack...");
    Quackle::Rack rr;
    Quackle::LetterString rackString;
    for (const auto &tile : jrack) {
        std::string letter = tile.value("letter","?");
        bool isBlank = tile.value("isBlank", false);
        char ch = std::toupper(letter[0]);
        if (isBlank) ch = '?';
        rackString.push_back(ch);
        debugLog("Rack tile: letter='" + letter + "', isBlank=" + std::string(isBlank ? "true" : "false") + ", final='" + std::string(1,ch) + "'");
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

    // Generate best move
    debugLog("Generating best move...");
    debugLog("Creating generator...");
    Quackle::Generator gen(pos);
    debugLog("Generator created, testing if it works...");
    
    // Now test kibitz step by step
    debugLog("Generator creation successful, now testing kibitz...");
    
    // For now, implement a simple fallback mechanism
    // TODO: Investigate why gen.kibitz(1) causes segmentation fault
    debugLog("Generator creation successful, but kibitz causes segfault - using fallback");
    
    // Simple fallback: return a basic move based on the rack
    std::string rackStr = rr.toString();
    debugLog("Rack string: " + rackStr);
    
    if (rackStr.length() >= 2) {
      // Try to make a simple 2-letter word
      std::string word = rackStr.substr(0, 2);
      debugLog("Attempting simple word: " + word);
      
      std::cout << R"({"tiles":[{"letter":")" << word[0] << R"(","points":1,"isBlank":false},{"letter":")" << word[1] << R"(","points":1,"isBlank":false}],"score":2,"words":[")" << word << R"("],"move_type":"play","engine_fallback":true,"error":"kibitz segfault - using simple fallback"})" << std::endl;
    } else {
      // Pass if rack is too small
      debugLog("Rack too small, passing");
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"rack too small"})" << std::endl;
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

