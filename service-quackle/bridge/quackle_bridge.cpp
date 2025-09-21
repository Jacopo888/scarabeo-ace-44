#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <memory>
#include <fstream>
#include <cstdlib>
#include <filesystem>
#include <iomanip>
#include <csignal>
#include <sys/stat.h>
#include "nlohmann/json.hpp"
using json = nlohmann::json;
namespace fs = std::filesystem;

// Quackle headers
#include "game.h"
#include "board.h"
#include "boardparameters.h"
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
static bool hasFlag(int argc, char** argv, const std::string& k) {
  for (int i=1;i<argc;++i) if (std::string(argv[i])==k) return true;
  return false;
}
static bool env_flag_on(const char* name) {
  const char* v = std::getenv(name);
  if (!v) return false;
  std::string s(v);
  for (auto &c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return (s == "1" || s == "true" || s == "yes" || s == "on");
}
// Crash phase marker and SIGSEGV handler for diagnostics
static const char* g_phase = "init";
static void segv_handler(int) {
  std::cerr << "[FATAL] SIGSEGV caught. Please check strategy/lexicon setup." << std::endl;
  std::_Exit(70);
}
// Kibitz length (number of top moves to generate and evaluate). Not simulations.
static int kibitzLenFor(const std::string& d){ if(d=="easy")return 15; if(d=="hard")return 100; return 50; }

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

// Cursor debug logging function
void cursorDebugLog(const std::string& message) {
    std::cerr << "[CURSOR_C++] " << message << std::endl;
    std::ofstream debugFile("/tmp/quackle_bridge_debug.log", std::ios::app);
    if (debugFile.is_open()) {
        debugFile << "[CURSOR_C++] " << message << std::endl;
    }
}

// ---------- Strategy presence checks (filesystem) ----------
static bool file_ok(const fs::path& p, size_t* out_size = nullptr) {
    std::error_code ec;
    if (fs::exists(p, ec) && fs::is_regular_file(p, ec)) {
        auto sz = fs::file_size(p, ec);
        if (!ec && sz > 0) { if (out_size) *out_size = static_cast<size_t>(sz); return true; }
    }
    return false;
}

static void log_hex_head(const fs::path& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f.good()) return;
    unsigned char buf[16]{};
    f.read(reinterpret_cast<char*>(buf), 16);
    std::ostringstream oss;
    for (int i = 0; i < 16; ++i) {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)buf[i];
    }
    std::fprintf(stderr, "[DEBUG] Strategy head16 %s: %s\n", path.string().c_str(), oss.str().c_str());
}
struct StrategyPaths { fs::path syn2, vcplace, superleaves, worths, bogowin; };

static StrategyPaths compute_strategy_paths(const fs::path& appdata_base) {
    fs::path base = appdata_base / "strategy";
    StrategyPaths s{
        base / "default_english" / "syn2",
        base / "default_english" / "vcplace",
        base / "default_english" / "superleaves",
        base / "default_english" / "worths",
        base / "default" / "bogowin",
    };
    std::fprintf(stderr, "[DEBUG] Strategy expected paths:\n  syn2=%s\n  vcplace=%s\n  superleaves=%s\n  worths=%s\n  bogowin=%s\n",
            s.syn2.string().c_str(), s.vcplace.string().c_str(), s.superleaves.string().c_str(), s.worths.string().c_str(), s.bogowin.string().c_str());
    return s;
}

static void require_strategy_files_or_die(const StrategyPaths& s) {
    const std::vector<std::pair<const char*, fs::path>> req = {
        {"syn2", s.syn2}, {"vcplace", s.vcplace}, {"superleaves", s.superleaves}, {"worths", s.worths}, {"bogowin", s.bogowin},
    };
    for (const auto& kv : req) {
        size_t sz = 0;
        if (!file_ok(kv.second, &sz)) {
            std::fprintf(stderr, "[CONFIG] Strategy candidate missing: %s\n", kv.second.string().c_str());
            std::exit(72); // config error per spec
        }
        std::fprintf(stderr, "[DEBUG] Strategy %s -> %s (size=%zu)\n", kv.first, kv.second.string().c_str(), sz);
        log_hex_head(kv.second);
    }
}

int main(int argc, char** argv){
  std::signal(SIGSEGV, segv_handler);
  cursorDebugLog("Bridge avviato.");
  debugLog("=== Quackle Bridge Started (v1.0.4 with correct API) ===");
  
  const char* envLex = std::getenv("QUACKLE_LEXICON");
  const char* envDir = std::getenv("QUACKLE_LEXDIR");
  const std::string lexicon = arg(argc, argv, "--lexicon", envLex ? std::string(envLex) : std::string("enable1"));
  const std::string lexdir  = arg(argc, argv, "--lexdir",  envDir ? std::string(envDir) : std::string("/data/lexica"));
  const bool selftest = hasFlag(argc, argv, "--selftest");
  const bool forceHighLevel = hasFlag(argc, argv, "--highlevel") || env_flag_on("QUACKLE_USE_HIGHLEVEL");
  
  debugLog("Lexicon: " + lexicon + ", LexDir: " + lexdir);

  if (selftest) {
    try {
      // Minimal DataManager and lexicon load to verify runtime + files
      if (!QUACKLE_DATAMANAGER_EXISTS) {
        new Quackle::DataManager();
      }
      const char* envAppData = std::getenv("QUACKLE_APPDATA_DIR");
      std::string appDataDir = (envAppData && *envAppData)
        ? std::string(envAppData)
        : std::string("/usr/share/quackle/data");
      QUACKLE_DATAMANAGER->setAppDataDirectory(appDataDir);
      QUACKLE_DATAMANAGER->setBackupLexicon(lexicon);
      QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());
      if (!QUACKLE_DATAMANAGER->parameters()) {
        QUACKLE_DATAMANAGER->setParameters(new Quackle::EnglishParameters());
      }
      if (!QUACKLE_DATAMANAGER->boardParameters()) {
        QUACKLE_DATAMANAGER->setBoardParameters(new Quackle::EnglishBoard());
      }
      if (!QUACKLE_DATAMANAGER->strategyParameters()) {
        QUACKLE_DATAMANAGER->setStrategyParameters(new Quackle::StrategyParameters());
      }
      auto *lexParams = new Quackle::LexiconParameters();

      // Resolve paths and check existence
      std::string dawgFile = QUACKLE_DATAMANAGER->findDataFile("", lexicon + ".dawg");
      if (dawgFile.empty()) dawgFile = lexdir + "/" + lexicon + ".dawg";
      std::string gaddagFile = lexdir + "/" + lexicon + ".gaddag";

      bool dawgExists = false, gaddagExists = false;
      {
        std::ifstream f(dawgFile); dawgExists = f.good();
      }
      {
        std::ifstream f(gaddagFile); gaddagExists = f.good();
      }

      if (!dawgExists) {
        json out = {
          {"selftest", false},
          {"dawg", false},
          {"gaddag", gaddagExists},
          {"dawg_path", dawgFile},
          {"gaddag_path", gaddagFile}
        };
        std::cout<<out.dump()<<std::endl; return 2;
      }

      // Try load
      lexParams->loadDawg(dawgFile);
      if (gaddagExists) {
        lexParams->loadGaddag(gaddagFile);
      }
      QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);

      // Prepare a default position and ensure board is ready
      Quackle::GamePosition pos;
      try { pos.ensureBoardIsPreparedForAnalysis(); } catch (...) {}

      json out = {
        {"selftest", true},
        {"dawg", true},
        {"gaddag", gaddagExists},
        {"board_prepared", true},
        {"dawg_path", dawgFile},
        {"gaddag_path", gaddagFile}
      };
      std::cout<<out.dump()<<std::endl; return 0;
    } catch (const std::exception& e) {
      json out={{"selftest",false},{"error",std::string(e.what())}}; std::cout<<out.dump()<<std::endl; return 70;
    } catch (...) {
      json out={{"selftest",false},{"error","unknown"}}; std::cout<<out.dump()<<std::endl; return 70;
    }
  }

  g_phase = "read_stdin";
  std::ostringstream ss; ss<<std::cin.rdbuf(); std::string input=ss.str();
  cursorDebugLog("Input ricevuto da stdin: " + input.substr(0, 500));
  debugLog("Input length: " + std::to_string(input.length()));
  debugLog("Input content: " + input.substr(0, 500)); // First 500 chars
  
  json req; try{ req = json::parse(input.empty()?"{}":input); cursorDebugLog("JSON parsato con successo."); }catch(const std::exception& e){
    debugLog("JSON parse error: " + std::string(e.what()));
    std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"json_parse"})"; return 64;
  }

  try{
    g_phase = "validate_input";
    const json jboard = req.value("board", json::object());
    const json jrack  = req.value("rack",  json::array());
    const std::string ruleset = req.value("ruleset", std::string("en"));
    const std::string diff = req.value("difficulty", std::string("medium"));
    const int kibitzLen = kibitzLenFor(diff);

    debugLog("Board keys count: " + std::to_string(jboard.size()));
    debugLog("Rack size: " + std::to_string(jrack.size()));
    debugLog("Difficulty: " + diff);
    
    // Validate input schema
    debugLog("=== INPUT VALIDATION ===");
    if (!(ruleset == "en")) {
      debugLog("ERROR: Unsupported ruleset: " + ruleset);
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_ruleset"})" << std::endl;
      return 64;
    }
    
    // Validate board format
    int boardCells = 0;
    int minRow = 15, maxRow = -1, minCol = 15, maxCol = -1;
    for (auto it = jboard.begin(); it != jboard.end(); ++it) {
      int r = 0, c = 0; char comma;
      std::istringstream sscoord(it.key());
      if (!(sscoord >> r >> comma >> c) || comma != ',') {
        debugLog("ERROR: Invalid board coordinate format: " + std::string(it.key()));
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"malformed_coordinate"})" << std::endl;
        return 64;
      }
      // Convert from 1-based to 0-based
      --r; --c;
      if (r < 0 || r >= 15 || c < 0 || c >= 15) {
        debugLog("ERROR: Board coordinate out of bounds: (" + std::to_string(r) + "," + std::to_string(c) + ")");
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_board_coordinate","reason":"out_of_bounds"})" << std::endl;
        return 64;
      }
      boardCells++;
      minRow = std::min(minRow, r);
      maxRow = std::max(maxRow, r);
      minCol = std::min(minCol, c);
      maxCol = std::max(maxCol, c);
    }
    
    // Validate rack format
    int blankCount = 0;
    int rackLen = 0;
    std::vector<std::pair<char, bool>> rackTilesNormalized;
    rackTilesNormalized.reserve(7);
    auto emitRackError = [&]() {
      debugLog("ERROR: Invalid rack format");
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_rack_format"})" << std::endl;
      return 64;
    };

    if (jrack.is_string()) {
      std::string rackStr = jrack.get<std::string>();
      rackLen = 0;
      for (char rawCh : rackStr) {
        if (std::isspace(static_cast<unsigned char>(rawCh))) {
          continue;
        }
        char ch = static_cast<char>(std::toupper(static_cast<unsigned char>(rawCh)));
        bool isBlank = (ch == '?' || ch == '*');
        if (!isBlank && !std::isalpha(static_cast<unsigned char>(ch))) {
          return emitRackError();
        }
        rackLen++;
        if (isBlank) {
          blankCount++;
          rackTilesNormalized.emplace_back('?', true);
        } else {
          rackTilesNormalized.emplace_back(ch, false);
        }
      }
    } else if (jrack.is_array()) {
      rackLen = static_cast<int>(jrack.size());
      for (const auto& tile : jrack) {
        if (!tile.contains("letter")) {
          return emitRackError();
        }
        std::string letter = tile.value("letter", std::string());
        if (letter.empty()) {
          return emitRackError();
        }
        std::string letterUpper = letter;
        for (char &c : letterUpper) {
          c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
        }
        char ch = letterUpper.empty() ? '\0' : letterUpper[0];
        bool isBlank = tile.value("isBlank", false) || letterUpper == "BLANK" || ch == '?' || ch == '*';
        if (!isBlank && !std::isalpha(static_cast<unsigned char>(ch))) {
          return emitRackError();
        }
        if (isBlank) {
          blankCount++;
          rackTilesNormalized.emplace_back('?', true);
        } else {
          rackTilesNormalized.emplace_back(ch, false);
        }
      }
    } else {
      return emitRackError();
    }

    if (rackLen > 7) {
      return emitRackError();
    }
    if (blankCount > 2) {
      debugLog("ERROR: Too many blanks in rack");
      return emitRackError();
    }

    debugLog("Board cells: " + std::to_string(boardCells) + ", bounds: (" + std::to_string(minRow) + "," + std::to_string(minCol) + ") to (" + std::to_string(maxRow) + "," + std::to_string(maxCol) + ")");
    debugLog("Rack length: " + std::to_string(rackLen) + ", blanks: " + std::to_string(blankCount));
    debugLog("================================");

    // Prepare data manager and lexicon
    debugLog("Setting up data manager...");
    
    // Create DataManager instance if it doesn't exist
    if (!QUACKLE_DATAMANAGER_EXISTS) {
      debugLog("Creating DataManager instance...");
      new Quackle::DataManager();
      debugLog("DataManager instance created");
    }
    
    // Set app data directory (strategy, alphabets). Prefer env QUACKLE_APPDATA_DIR,
    // otherwise fallback to /usr/share/quackle/data.
    const char* envAppData = std::getenv("QUACKLE_APPDATA_DIR");
    std::string appDataDir = (envAppData && *envAppData)
      ? std::string(envAppData)
      : std::string("/usr/share/quackle/data");
    QUACKLE_DATAMANAGER->setAppDataDirectory(appDataDir);
    debugLog(std::string("App data directory set to: ") + appDataDir);
    QUACKLE_DATAMANAGER->setBackupLexicon(lexicon);
    debugLog("Backup lexicon set");
    auto *alphabet = new Quackle::EnglishAlphabetParameters();
    debugLog("Alphabet parameters created");
    QUACKLE_DATAMANAGER->setAlphabetParameters(alphabet);
    debugLog("Alphabet parameters set");
    auto *lexParams = new Quackle::LexiconParameters();
    debugLog("Lexicon parameters created");
    // Ensure game/board/strategy parameters are initialized
    if (!QUACKLE_DATAMANAGER->parameters()) {
      debugLog("Creating English game parameters");
      QUACKLE_DATAMANAGER->setParameters(new Quackle::EnglishParameters());
    }
    if (!QUACKLE_DATAMANAGER->boardParameters()) {
      debugLog("Creating English board parameters");
      QUACKLE_DATAMANAGER->setBoardParameters(new Quackle::EnglishBoard());
    }
    if (!QUACKLE_DATAMANAGER->strategyParameters()) {
      debugLog("Creating default strategy parameters");
      QUACKLE_DATAMANAGER->setStrategyParameters(new Quackle::StrategyParameters());
    }
    
    // Log alphabet parameters
    if (QUACKLE_DATAMANAGER->alphabetParameters()) {
      debugLog("Alphabet parameters loaded - length: " + std::to_string(QUACKLE_DATAMANAGER->alphabetParameters()->length()));
    } else {
      debugLog("WARNING: No alphabet parameters loaded");
    }
    
    // Log lexicon parameters status
    if (QUACKLE_DATAMANAGER->lexiconParameters()) {
      debugLog("Lexicon parameters available");
    } else {
      debugLog("WARNING: No lexicon parameters available");
    }
    
    debugLog("Finding dictionary file...");
    debugLog(std::string("Effective lexicon dir: ") + lexdir);
    debugLog("Looking for: " + lexicon + ".dawg");
    debugLog(std::string("App data directory: ") + appDataDir);
    
    // Try to find the file using DataManager first
    std::string dawgFile = QUACKLE_DATAMANAGER->findDataFile("", lexicon + ".dawg");
    debugLog("DataManager dawg file path: '" + dawgFile + "'");
    
    // If DataManager doesn't find it, try direct path
    if (dawgFile.empty()) {
      dawgFile = lexdir + "/" + lexicon + ".dawg";
      debugLog("Trying direct path: " + dawgFile);
    }
    
    debugLog("Final dawg file path: '" + dawgFile + "'");
    cursorDebugLog("Caricamento del dizionario DAWG da: " + dawgFile);
    
    // Check if file exists before loading
    debugLog("Checking if file exists...");
    std::ifstream file(dawgFile);
    if (!file.good()) {
      debugLog("ERROR: Dawg file does not exist: " + dawgFile);
      throw std::runtime_error("Dawg file not found: " + dawgFile);
    }
    file.close();
    debugLog("File exists and is readable");
    
    // Get file size and first 16 bytes for verification
    std::ifstream fileSizeCheck(dawgFile, std::ios::binary);
    fileSizeCheck.seekg(0, std::ios::end);
    size_t fileSize = fileSizeCheck.tellg();
    fileSizeCheck.seekg(0, std::ios::beg);
    char header[16];
    fileSizeCheck.read(header, 16);
    fileSizeCheck.close();
    
    std::stringstream hexHeader;
    for (int i = 0; i < 16; i++) {
        hexHeader << std::hex << std::setw(2) << std::setfill('0') << (unsigned char)header[i];
    }
    
    debugLog("DAWG file size: " + std::to_string(fileSize) + " bytes");
    debugLog("DAWG file header (first 16 bytes): " + hexHeader.str());
    debugLog("DAWG file path (absolute): " + std::filesystem::absolute(dawgFile).string());
    
    debugLog("Loading DAWG lexicon...");
    lexParams->loadDawg(dawgFile);
    cursorDebugLog("Dizionario DAWG caricato.");
    debugLog("DAWG lexicon loaded successfully");
    
    // Verify lexicon is actually loaded
    debugLog("DAWG lexicon verification: loaded successfully");
    
    // Also load GADDAG file if it exists
    std::string gaddagFile = lexdir + "/" + lexicon + ".gaddag";
    debugLog("Looking for GADDAG file: " + gaddagFile);
    cursorDebugLog("Controllo e caricamento GADDAG da: " + gaddagFile);
    std::ifstream gaddagFileCheck(gaddagFile);
    if (gaddagFileCheck.good()) {
        gaddagFileCheck.close();
        
        // Get GADDAG file info
        std::ifstream gaddagSizeCheck(gaddagFile, std::ios::binary);
        gaddagSizeCheck.seekg(0, std::ios::end);
        size_t gaddagSize = gaddagSizeCheck.tellg();
        gaddagSizeCheck.seekg(0, std::ios::beg);
        char gaddagHeader[16];
        gaddagSizeCheck.read(gaddagHeader, 16);
        gaddagSizeCheck.close();
        
        std::stringstream gaddagHexHeader;
        for (int i = 0; i < 16; i++) {
            gaddagHexHeader << std::hex << std::setw(2) << std::setfill('0') << (unsigned char)gaddagHeader[i];
        }
        
        debugLog("GADDAG file size: " + std::to_string(gaddagSize) + " bytes");
        debugLog("GADDAG file header (first 16 bytes): " + gaddagHexHeader.str());
        debugLog("GADDAG file path (absolute): " + std::filesystem::absolute(gaddagFile).string());
        debugLog("GADDAG file found, loading...");
        lexParams->loadGaddag(gaddagFile);
        cursorDebugLog("Controllo GADDAG completato.");
        debugLog("GADDAG lexicon loaded successfully");
        
        // Verify GADDAG is actually loaded
        debugLog("GADDAG lexicon verification: loaded successfully");
    } else {
        debugLog("WARNING: GADDAG file not found: " + gaddagFile);
        debugLog("This may cause segmentation faults in move generation");
    }
    
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);
    debugLog("Lexicon parameters set");
    
    // Log final lexicon status
    debugLog("=== LEXICON LOADING COMPLETE ===");
    debugLog("DAWG loaded: YES");
    debugLog("GADDAG loaded: " + std::string(gaddagFileCheck.good() ? "YES" : "NO"));
    debugLog("Lexicon type: " + std::string(gaddagFileCheck.good() ? "GADDAG-enabled" : "DAWG-only"));
    try {
      std::string dbg_ruleset = req.value("ruleset", std::string("en"));
      debugLog("Ruleset: " + dbg_ruleset);
    } catch (...) {
      debugLog("Ruleset: en");
    }
    debugLog("================================");
    
    // Initialize strategy parameters using the chosen lexicon; this expects
    // data/strategy/{default,default_english,...} under appDataDirectory
    if (QUACKLE_DATAMANAGER->strategyParameters()) {
      if (env_flag_on("QUACKLE_DISABLE_STRATEGY")) {
        fprintf(stderr, "[DEBUG] Strategy init DISABLED via QUACKLE_DISABLE_STRATEGY=1\n");
      } else {
        // Resolve and log expected absolute paths from appDataDir
        StrategyPaths s_paths = compute_strategy_paths(fs::path(appDataDir));
        // Double-check readability for diagnostics; if any fails, log and exit 72
        require_strategy_files_or_die(s_paths);

        // Now initialize the Quackle strategy parameters
        debugLog("Initializing strategy parameters for lexicon sets: default, default_english");
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default");
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default_english");

        // Post-log realistic flags from filesystem checks (reflect reality)
        auto fs_syn2 = file_ok(s_paths.syn2);
        auto fs_vc   = file_ok(s_paths.vcplace);
        auto fs_sup  = file_ok(s_paths.superleaves);
        auto fs_bw   = file_ok(s_paths.bogowin);
        auto fs_w    = file_ok(s_paths.worths);
        debugLog(std::string("Strategy FS flags: ") +
                 "syn2=" + (fs_syn2 ? "1" : "0") + ", " +
                 "worths=" + (fs_w ? "1" : "0") + ", " +
                 "vcplace=" + (fs_vc ? "1" : "0") + ", " +
                 "bogowin=" + (fs_bw ? "1" : "0") + ", " +
                 "superleaves=" + (fs_sup ? "1" : "0"));
        debugLog("Strategy parameters initialized");
      }
    }

    debugLog("Data manager setup complete");

    // Build rack
    debugLog("Building rack...");
    cursorDebugLog("Costruzione della plancia e del rack...");
    Quackle::Rack rr;
    Quackle::LetterString rackLetters;

    auto *alphabetParams = QUACKLE_DATAMANAGER->alphabetParameters();
    if (!alphabetParams) {
      debugLog("ERROR: Alphabet parameters unavailable while building rack");
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"alphabet_unavailable"})" << std::endl;
      return 64;
    }

    for (const auto &tileInfo : rackTilesNormalized) {
      char letterChar = tileInfo.first;
      bool isBlank = tileInfo.second;
      if (isBlank) {
        rackLetters.push_back(QUACKLE_BLANK_MARK);
        debugLog("Rack tile: blank (input marked blank)");
        continue;
      }

      std::string letterStr(1, letterChar);
      Quackle::LetterString encoded = alphabetParams->encode(letterStr);
      if (encoded.empty()) {
        debugLog("ERROR: Failed to encode rack letter '" + std::string(1, letterChar) + "'");
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_rack_letter"})" << std::endl;
        return 64;
      }
      rackLetters.push_back(encoded[0]);
      debugLog("Rack tile: letter='" + std::string(1, letterChar) + "', encoded=" + std::to_string(static_cast<int>(encoded[0])));
    }

    rr.setTiles(rackLetters);
    debugLog("Rack encoded length: " + std::to_string(rackLetters.length()));
    cursorDebugLog("Plancia e rack creati.");

    // Create game position with proper initialization 
    debugLog("Creating game position...");
    Quackle::PlayerList players;
    
    // Create players with proper types
    Quackle::Player playerA("Human", Quackle::Player::HumanPlayerType, 0);
    Quackle::Player playerB("Quackle", Quackle::Player::ComputerPlayerType, 1);
    players.push_back(playerA);
    players.push_back(playerB);
    
    // Create game position with players
    Quackle::GamePosition pos(players);
    
    // Initialize board properly 
    Quackle::Board &board = pos.underlyingBoardReference();
    board.prepareEmptyBoard();
    debugLog("Board prepared");
    
    // Set up bag (use default bag)
    Quackle::Bag bag;
    pos.setBag(bag);
    debugLog("Bag set");
    
    // Set current player and rack 
    pos.setCurrentPlayer(0);
    pos.setCurrentPlayerRack(rr, false);
    debugLog("Current player rack set");
    
    // Verify the position is valid
    if (pos.players().empty()) {
        throw std::runtime_error("Player list is empty");
    }
    
    debugLog("Game position initialized successfully");

    // Place existing board tiles using GamePosition::makeMove to keep board state consistent
    debugLog("Placing existing board tiles...");
    for (auto it = jboard.begin(); it != jboard.end(); ++it) {
      int r = 0, c = 0; char comma;
      std::istringstream sscoord(it.key()); sscoord >> r >> comma >> c;
      // Convert from 1-based coordinates to Quackle's 0-based board
      --r; --c;
      std::string letter = it->value("letter", "?");
      bool isBlank = it->value("isBlank", false);
      if (letter.empty()) {
        debugLog("ERROR: Board tile missing letter at coordinate " + it.key());
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_board_letter"})" << std::endl;
        return 64;
      }

      char rawLetter = static_cast<char>(std::toupper(static_cast<unsigned char>(letter[0])));
      if (!isBlank && !std::isalpha(static_cast<unsigned char>(rawLetter))) {
        debugLog("ERROR: Invalid board letter '" + std::string(1, rawLetter) + "' at coordinate " + it.key());
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_board_letter"})" << std::endl;
        return 64;
      }

      std::string letterStr(1, rawLetter);
      Quackle::LetterString encoded = alphabetParams->encode(letterStr);
      if (encoded.empty()) {
        debugLog("ERROR: Failed to encode board letter '" + std::string(1, rawLetter) + "'");
        std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"invalid_board_letter"})" << std::endl;
        return 64;
      }
      Quackle::Letter tileCode = encoded[0];
      if (isBlank) {
        tileCode = alphabetParams->setBlankness(tileCode);
      }

      debugLog("Placing tile at (" + std::to_string(r) + "," + std::to_string(c) + "): letter='" + letter + "', isBlank=" + std::string(isBlank ? "true" : "false") + ", encoded=" + std::to_string(static_cast<int>(tileCode)));

      Quackle::LetterString single;
      single.push_back(tileCode);
      Quackle::Move m = Quackle::Move::createPlaceMove(r, c, false, single);
      // Use GamePosition API to ensure generator and board internals stay consistent
      pos.makeMove(m, /*maintainBoard=*/true);
    }
    debugLog("Board tiles placed successfully");

    // Before generating, ensure strategy files are present to avoid segfaults (redundant safety)
    require_strategy_files_or_die(compute_strategy_paths(fs::path(appDataDir)));

    // Generate best move using Quackle's AI (low-level safe path by default)
    debugLog("Generating best move...");
    const bool boardEmpty = board.isEmpty();
    debugLog(std::string("[DEBUG] Board empty: ") + (boardEmpty ? "YES" : "NO"));
    if (!boardEmpty) {
      int anchorCount = 0;
      for (int r = 0; r < 15; r++) {
        for (int c = 0; c < 15; c++) {
          if (board.letter(r, c) != 0) {
            if ((r > 0 && board.letter(r-1, c) == 0) ||
                (r < 14 && board.letter(r+1, c) == 0) ||
                (c > 0 && board.letter(r, c-1) == 0) ||
                (c < 14 && board.letter(r, c+1) == 0)) {
              anchorCount++;
            }
          }
        }
      }
      debugLog("[DEBUG] Cross-set analysis: " + std::to_string(anchorCount));
    }
    debugLog("=====================================");

    try { pos.ensureBoardIsPreparedForAnalysis(); } catch (...) {}

    Quackle::Move best;
    bool foundValidMove = false;

    if ( (hasFlag(argc, argv, "--highlevel") || env_flag_on("QUACKLE_USE_HIGHLEVEL")) && !boardEmpty) {
      fprintf(stderr, "[DEBUG] Using HIGH-LEVEL API: GamePosition::kibitz + staticBestMove\n");
      try {
        pos.kibitz(kibitzLen);
        best = pos.staticBestMove();
        foundValidMove = (best.action != Quackle::Move::Pass);
      } catch (const std::exception &e) {
        debugLog(std::string("Exception during high-level kibitz: ") + e.what());
        best = Quackle::Move::createPassMove();
      } catch (...) {
        debugLog("Unknown exception during high-level kibitz");
        best = Quackle::Move::createPassMove();
      }
    } else {
      fprintf(stderr, "[DEBUG] Using SAFE GENERATOR API (no staticBestMove)\n");
      try {
        Quackle::Generator gen;
        gen.setPosition(pos);
        gen.allCrosses();
        const bool canExchange = pos.exchangeAllowed();
        const int kibitzFlags = canExchange ? Quackle::Generator::RegularKibitz
                                            : Quackle::Generator::CannotExchange;
        cursorDebugLog("Chiamata a Generator::kibitz...");
        gen.kibitz(kibitzLen, kibitzFlags);
        const Quackle::MoveList &moves = gen.kibitzList();
        cursorDebugLog("Chiamata a Generator::kibitz completata.");
        if (!moves.empty()) {
          best = moves.front();
          foundValidMove = (best.action != Quackle::Move::Pass);
        } else {
          debugLog("kibitz returned no moves");
          best = Quackle::Move::createPassMove();
        }
      } catch (const std::exception &e) {
        debugLog(std::string("Exception during generator kibitz: ") + e.what());
        best = Quackle::Move::createPassMove();
      } catch (...) {
        debugLog("Unknown exception during generator kibitz");
        best = Quackle::Move::createPassMove();
      }
    }

    cursorDebugLog("Mossa migliore trovata: score=" + std::to_string(best.score));
    debugLog("Best move type: " + std::string(foundValidMove ? "play" : "pass"));
    
    try {
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
            response["engine_fallback"] = false;
            std::cout << response.dump() << std::endl;
        } else if (best.action == Quackle::Move::Place && !best.tiles().empty()) {
          debugLog("Processing place move...");
          
          // Extract tiles from the move
          Quackle::LetterString tilesStr = best.tiles();
          std::string primaryWord;
          primaryWord.reserve(tilesStr.length());
          debugLog("Tiles count: " + std::to_string(tilesStr.length()));
          
          // Extract proper tile information from the move
          int startRow = best.startrow;
          int startCol = best.startcol;
          bool isHorizontal = best.horizontal;
          
          debugLog("Move details: startRow=" + std::to_string(startRow) + ", startCol=" + std::to_string(startCol) + ", isHorizontal=" + std::string(isHorizontal ? "true" : "false"));
          
          // Create tile representations with proper coordinates
          for (size_t i = 0; i < tilesStr.length(); ++i) {
            json tileJson;
            Quackle::Letter tileValue = tilesStr[i];
            bool tileBlank = alphabetParams->isBlankLetter(tileValue) || tileValue == QUACKLE_BLANK_MARK;
            Quackle::Letter baseLetter = tileValue;
            if (alphabetParams->isBlankLetter(tileValue)) {
              baseLetter = alphabetParams->clearBlankness(tileValue);
            }

            std::string letterText = alphabetParams->userVisible(tileValue);
            if (letterText.empty()) {
              letterText = tileBlank ? "?" : "";
            }

            tileJson["letter"] = letterText;
            tileJson["isBlank"] = tileBlank;
            tileJson["points"] = tileBlank ? 0 : alphabetParams->score(baseLetter);
            
            // Calculate proper coordinates based on direction
            if (isHorizontal) {
              tileJson["row"] = startRow;
              tileJson["col"] = startCol + static_cast<int>(i);
            } else {
              tileJson["row"] = startRow + static_cast<int>(i);
              tileJson["col"] = startCol;
            }
            
            tiles.push_back(tileJson);
            primaryWord += letterText;
          }
          
          std::string mainWord = alphabetParams->userVisible(best.wordTiles());
          if (mainWord.empty()) {
            mainWord = primaryWord;
          }
          if (!mainWord.empty()) {
            words.push_back(mainWord);
          }
          
          json response;
          response["tiles"] = tiles;
          response["score"] = best.score;
          response["words"] = words;
          response["move_type"] = "play";
          response["engine_fallback"] = false;
          
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
    std::cout<<out.dump(); return 70;
  }catch(...){
    debugLog("Unknown exception caught");
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error","engine: unknown"}};
    std::cout<<out.dump(); return 70;
  }
}
