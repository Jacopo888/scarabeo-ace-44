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
#include <set>
#include "include/bridge_utils.hpp"
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

// arg/flag helpers now provided by bridge_utils.hpp
// Crash phase marker and SIGSEGV handler for diagnostics
static const char* g_phase = "init";
static void segv_handler(int) {
  std::cerr << "[FATAL] SIGSEGV caught. Please check strategy/lexicon setup." << std::endl;
  std::_Exit(70);
}
// Kibitz length (number of top moves to generate and evaluate). Not simulations.
static int kibitzLenFor(const std::string& d){ if(d=="easy")return 15; if(d=="hard")return 100; return 50; }

// debugLog/cursorDebugLog now provided by bridge_utils.hpp

// strategy file helpers now provided by bridge_utils.hpp

int main(int argc, char** argv){
  std::signal(SIGSEGV, segv_handler);
  cursorDebugLog("Bridge avviato.");
  debugLog("=== Quackle Bridge Started (v1.0.4 with correct API) ===");
  for (int i = 0; i < argc; ++i) {
    debugLog(std::string("argv[") + std::to_string(i) + "]: " + argv[i]);
  }
  
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
  
  json req; try{ req = json::parse(input.empty()?"{}":input); cursorDebugLog("JSON parsato con successo."); debugLog(std::string("Parsed JSON: ") + req.dump(2)); }catch(const std::exception& e){
    debugLog("JSON parse error: " + std::string(e.what()));
    std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true,"error":"json_parse"})"; return 64;
  }

  try{
    // Support diagnostic op without engaging heavy init
    const std::string op = req.value("op", std::string("compute"));
    if (op == "probe_strategy") {
      // Minimal DataManager with appdata dir
      if (!QUACKLE_DATAMANAGER_EXISTS) new Quackle::DataManager();
      const char* envAppData = std::getenv("QUACKLE_APPDATA_DIR");
      std::string appDataDir = (envAppData && *envAppData) ? std::string(envAppData) : std::string("/usr/share/quackle/data");
      QUACKLE_DATAMANAGER->setAppDataDirectory(appDataDir);

      StrategyPaths s_paths = compute_strategy_paths(fs::path(appDataDir));
      json fscheck = json::object();
      auto stat_one = [&](const char* key, const fs::path& p){
        json j; j["path"] = p.string(); size_t sz=0; bool ok=file_ok(p,&sz); j["exists"]=ok; j["size"]=ok?(int64_t)sz:0; if(ok){
          std::ifstream f(p, std::ios::binary); unsigned char buf[16]{}; f.read((char*)buf,16); std::ostringstream oss; for(int i=0;i<16;++i){ oss<< std::hex<< std::setw(2)<< std::setfill('0')<< (int)buf[i]; }
          j["head16"]=oss.str();
        }
        fscheck[key]=j;
      };
      stat_one("default_english/syn2", s_paths.syn2);
      stat_one("default_english/vcplace", s_paths.vcplace);
      stat_one("default_english/superleaves", s_paths.superleaves);
      stat_one("default_english/worths", s_paths.worths);
      stat_one("default/bogowin", s_paths.bogowin);

      // Also attempt DataManager resolution
      json dm = json::object();
      try{
        dm["syn2"]       = QUACKLE_DATAMANAGER->findDataFile("strategy","default_english","syn2");
        dm["vcplace"]    = QUACKLE_DATAMANAGER->findDataFile("strategy","default_english","vcplace");
        dm["superleaves"] = QUACKLE_DATAMANAGER->findDataFile("strategy","default_english","superleaves");
        dm["worths"]     = QUACKLE_DATAMANAGER->findDataFile("strategy","default_english","worths");
        dm["bogowin"]    = QUACKLE_DATAMANAGER->findDataFile("strategy","default","bogowin");
      }catch(...){ dm["error"] = "findDataFile_exception"; }

      json out = {
        {"engine_fallback", false},
        {"app_data_dir", appDataDir},
        {"fscheck", fscheck},
        {"resolved", dm}
      };
      std::cout << out.dump() << std::endl; return 0;
    }

    g_phase = "validate_input";
    const json jboard = req.value("board", json::object());
    std::set<std::pair<int,int>> originalBoardSquares;
    const json jrack  = req.value("rack",  json::array());
    const std::string ruleset = req.value("ruleset", std::string("en"));
    const std::string diff = req.value("difficulty", std::string("medium"));
    const int kibitzLen = kibitzLenFor(diff);

    debugLog("Board keys count: " + std::to_string(jboard.size()));
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
      originalBoardSquares.insert({r, c});
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
    debugLog("Rack size: " + std::to_string(rackLen));
    debugLog("Rack blanks: " + std::to_string(blankCount));
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
      const char* modeEnv = std::getenv("QUACKLE_INIT_MODE");
      std::string initMode = modeEnv ? std::string(modeEnv) : std::string("both");
      for (auto &c : initMode) c = (char)std::tolower((unsigned char)c);
        // Resolve and log expected absolute paths from appDataDir
        StrategyPaths s_paths = compute_strategy_paths(fs::path(appDataDir));
        // Double-check readability for diagnostics; if any fails, log and exit 72
        require_strategy_files_or_die(s_paths);

        // Second-choice: ensure DataManager findDataFile resolves the same files (dry-run)
        try {
          std::string f_syn2 = QUACKLE_DATAMANAGER->findDataFile("strategy", "default_english", "syn2");
          std::string f_vc   = QUACKLE_DATAMANAGER->findDataFile("strategy", "default_english", "vcplace");
          std::string f_sup  = QUACKLE_DATAMANAGER->findDataFile("strategy", "default_english", "superleaves");
          std::string f_w    = QUACKLE_DATAMANAGER->findDataFile("strategy", "default_english", "worths");
          std::string f_bw   = QUACKLE_DATAMANAGER->findDataFile("strategy", "default",          "bogowin");

          struct Res { const char* name; std::string path; };
          std::vector<Res> resolved = {
            {"default_english/syn2", f_syn2},
            {"default_english/vcplace", f_vc},
            {"default_english/superleaves", f_sup},
            {"default_english/worths", f_w},
            {"default/bogowin", f_bw},
          };
          std::vector<std::string> missing;
          std::vector<std::string> unreadable;
          for (const auto &r : resolved) {
            if (r.path.empty()) {
              std::fprintf(stderr, "[CONFIG] resolve failed: strategy/%s\n", r.name);
              missing.push_back(r.name);
            } else {
              std::error_code ec;
              fs::path p(r.path);
              if (!(fs::exists(p, ec) && fs::is_regular_file(p, ec) && fs::file_size(p, ec) > 0)) {
                std::fprintf(stderr, "[CONFIG] resolved but not readable: %s\n", r.path.c_str());
                unreadable.push_back(r.name);
              }
            }
          }
          if (!missing.empty() || !unreadable.empty()) {
            json j; j["engine_fallback"] = true; j["error"] = "strategy_missing"; j["rc"] = 72;
            j["app_data_dir"] = appDataDir;
            if (!missing.empty()) j["missing"] = missing;
            if (!unreadable.empty()) j["unreadable"] = unreadable;
            std::cout << j.dump() << std::endl;
            std::exit(72);
          }
          std::fprintf(stderr, "[DEBUG] DataManager resolved:\n syn2=%s\n vcplace=%s\n superleaves=%s\n worths=%s\n bogowin=%s\n",
              f_syn2.c_str(), f_vc.c_str(), f_sup.c_str(), f_w.c_str(), f_bw.c_str());
        } catch (...) {
          // If findDataFile throws in this build, prefer failing early
          json j = { {"engine_fallback", true}, {"error", "strategy_missing"}, {"rc", 72}, {"cause", "findDataFile_exception"} };
          std::cout << j.dump() << std::endl;
          std::fprintf(stderr, "[CONFIG] DataManager findDataFile raised while resolving strategy files\n");
          std::exit(72);
        }

        // Now initialize the Quackle strategy parameters (configurable steps)
        debugLog("Initializing strategy parameters (mode=" + initMode + ")");
        if (initMode == "default" || initMode == "both") {
          debugLog("init -> default");
          QUACKLE_DATAMANAGER->strategyParameters()->initialize("default");
          debugLog("init <- default (ok)");
        }
        if (initMode == "english" || initMode == "both") {
          debugLog("init -> default_english");
          QUACKLE_DATAMANAGER->strategyParameters()->initialize("default_english");
          debugLog("init <- default_english (ok)");
        }

        // Guard-rail: after initialize, assert the tables are actually loaded; otherwise abort rc=72
        {
          auto *sp = QUACKLE_DATAMANAGER->strategyParameters();
          bool ok = (sp && sp->hasSyn2() && sp->hasVcPlace() && sp->hasSuperleaves() && sp->hasWorths() && sp->hasBogowin());
          if (!ok) {
            std::fprintf(stderr, "[CONFIG] Strategy parameters missing after initialize()\n");
            std::fprintf(stderr, "[CONFIG] has: syn2=%d vcplace=%d superleaves=%d worths=%d bogowin=%d\n",
                         sp ? sp->hasSyn2() : 0, sp ? sp->hasVcPlace() : 0, sp ? sp->hasSuperleaves() : 0, sp ? sp->hasWorths() : 0, sp ? sp->hasBogowin() : 0);
            json j; j["engine_fallback"] = true; j["error"] = "strategy_missing"; j["rc"] = 72; j["app_data_dir"] = appDataDir;
            std::vector<std::string> miss;
            if (!(sp && sp->hasSyn2())) miss.push_back("default_english/syn2");
            if (!(sp && sp->hasVcPlace())) miss.push_back("default_english/vcplace");
            if (!(sp && sp->hasSuperleaves())) miss.push_back("default_english/superleaves");
            if (!(sp && sp->hasWorths())) miss.push_back("default_english/worths");
            if (!(sp && sp->hasBogowin())) miss.push_back("default/bogowin");
            if (!miss.empty()) j["missing"] = miss;
            std::cout << j.dump() << std::endl;
            std::exit(72);
          }
        }

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
    
    // Set current player and rack (force recalculation of internals)
    pos.setCurrentPlayer(0);
    pos.setCurrentPlayerRack(rr, true);
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

    // Before generating, ensure strategy files are present and strategy loaded
    // Always require strategy files before generation
    {
      require_strategy_files_or_die(compute_strategy_paths(fs::path(appDataDir)));
    }
    {
      if (auto *sp_chk = QUACKLE_DATAMANAGER->strategyParameters()) {
        if (!(sp_chk->hasSyn2() && sp_chk->hasVcPlace() && sp_chk->hasSuperleaves() && sp_chk->hasWorths() && sp_chk->hasBogowin())) {
          std::fprintf(stderr, "[CONFIG] Strategy not fully loaded before move generation\n");
          std::fprintf(stderr, "[CONFIG] has: syn2=%d vcplace=%d superleaves=%d worths=%d bogowin=%d\n",
                       sp_chk->hasSyn2(), sp_chk->hasVcPlace(), sp_chk->hasSuperleaves(), sp_chk->hasWorths(), sp_chk->hasBogowin());
          json j; j["engine_fallback"] = true; j["error"] = "strategy_missing"; j["rc"] = 72; j["stage"] = "pre_generation"; j["app_data_dir"] = appDataDir;
          std::vector<std::string> miss;
          if (!sp_chk->hasSyn2())        miss.push_back("default_english/syn2");
          if (!sp_chk->hasVcPlace())     miss.push_back("default_english/vcplace");
          if (!sp_chk->hasSuperleaves()) miss.push_back("default_english/superleaves");
          if (!sp_chk->hasWorths())      miss.push_back("default_english/worths");
          if (!sp_chk->hasBogowin())     miss.push_back("default/bogowin");
          if (!miss.empty()) j["missing"] = miss;
          std::cout << j.dump() << std::endl;
          std::exit(72);
        }
      } else {
        std::fprintf(stderr, "[CONFIG] StrategyParameters null before move generation\n");
        json j = { {"engine_fallback", true}, {"error", "strategy_missing"}, {"rc", 72}, {"stage", "pre_generation"}, {"cause", "StrategyParameters_null"}, {"app_data_dir", appDataDir} };
        std::cout << j.dump() << std::endl;
        std::exit(72);
      }
    }

    debugLog("Starting move generation...");
    // Generate best move: prefer High-Level GamePosition::kibitz, then fallback to Generator if needed
    debugLog("Generating best move (HL first, then GEN fallback)...");
    const bool boardEmpty = board.isEmpty();
    debugLog(std::string("[DEBUG] Board empty: ") + (boardEmpty ? "YES" : "NO"));
    try { pos.ensureBoardIsPreparedForAnalysis(); } catch (...) {}

    Quackle::Move best;
    bool foundValidMove = false;

    // High-Level path
    try {
      fprintf(stderr, "[DEBUG] Using HIGH-LEVEL API: GamePosition::kibitz + staticBestMove\n");
      pos.kibitz(kibitzLen);
      debugLog(std::string("High-level kibitz done. Moves found: ") + std::to_string(pos.moves().size()));
      // Prefer a placement from the HL move list
      best = Quackle::Move::createPassMove();
      const Quackle::MoveList &hlMoves = pos.moves();
      for (const auto &m : hlMoves) {
        if (m.action == Quackle::Move::Place) { best = m; break; }
      }
      if (best.action != Quackle::Move::Place) {
        // Fallback to staticBestMove if no explicit Place was found
        best = pos.staticBestMove();
      }
      // Consider a Place move valid even if tiles() is empty; we'll reconstruct tiles from wordTiles().
      foundValidMove = (best.action == Quackle::Move::Place);
      fprintf(stderr, "[DEBUG] HL result: action=%d score=%d\n", (int)best.action, best.score);
    } catch (const std::exception &e) {
      debugLog(std::string("Exception during high-level kibitz: ") + e.what());
      best = Quackle::Move::createPassMove();
      foundValidMove = false;
    } catch (...) {
      debugLog("Unknown exception during high-level kibitz");
      best = Quackle::Move::createPassMove();
      foundValidMove = false;
    }

    // Fallback to Generator if HL produced pass or no move
    if (!foundValidMove) {
      try {
        fprintf(stderr, "[DEBUG] Fallback: Using GENERATOR API via setPosition()\n");
        Quackle::Generator gen;
        gen.setPosition(pos);
        gen.allCrosses();
        // Prefer generating actual placement moves for service responses.
        // Disallow exchanges in generator path to avoid non-play results on opening.
        const int kibitzFlags = Quackle::Generator::CannotExchange;
        gen.kibitz(kibitzLen, kibitzFlags);
        debugLog(std::string("Generator kibitz done. Moves found: ") + std::to_string(gen.kibitzList().size()));
        const Quackle::MoveList &moves = gen.kibitzList();
        fprintf(stderr, "[DEBUG] GEN kibitz moves count=%d\n", (int)moves.size());
        if (!moves.empty()) {
          best = moves.front();
          foundValidMove = (best.action != Quackle::Move::Pass);
        } else {
          debugLog("GEN kibitz returned no moves");
          best = Quackle::Move::createPassMove();
        }
      } catch (const std::exception &e) {
        debugLog(std::string("Exception during generator kibitz: ") + e.what());
        best = Quackle::Move::createPassMove();
        foundValidMove = false;
      } catch (...) {
        debugLog("Unknown exception during generator kibitz");
        best = Quackle::Move::createPassMove();
        foundValidMove = false;
      }
    }

    // Ensure the move has a proper point score before serializing.
    // Some generator paths do not populate Move::score; compute it via GamePosition.
    try {
      if (foundValidMove && best.action == Quackle::Move::Place && best.score == 0) {
        pos.scoreMove(best);
      }
    } catch (...) {
      // Leave score as-is on any exception
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
          
          // Walk along the word path step-by-step to keep perfect alignment
          // with tilesStr (which may include '.' placeholders for existing tiles).
          {
            int rr = startRow;
            int cc = startCol;
            auto adv = [&](int &r, int &c) { if (isHorizontal) ++c; else ++r; };
            // If tilesStr is empty (some HL paths omit it), derive letters from wordTiles().
            Quackle::LetterString seq = tilesStr;
            if (seq.length() == 0) {
              seq = best.wordTiles();
            }
            for (size_t i = 0; i < seq.length(); ++i) {
              Quackle::Letter tileValue = seq[i];
              // Determine if this step uses an existing board tile using either
              // the original board occupancy or a visible '.' from Quackle.
              std::string uv = alphabetParams->userVisible(tileValue);
              bool isDotPlaceholder = (!uv.empty() && uv[0] == '.');
              bool occupied = originalBoardSquares.count({rr, cc}) > 0;

              if (!(isDotPlaceholder || occupied)) {
                bool tileBlank = alphabetParams->isBlankLetter(tileValue) || tileValue == QUACKLE_BLANK_MARK;
                Quackle::Letter baseLetter = tileValue;
                if (alphabetParams->isBlankLetter(tileValue)) {
                  baseLetter = alphabetParams->clearBlankness(tileValue);
                }

                // Visible letter (for blanks use the base letter), never emit '.'
                std::string letterText = alphabetParams->userVisible(tileBlank ? baseLetter : tileValue);
                if (letterText.empty() || (letterText.size() == 1 && letterText[0] == '.')) {
                  letterText = tileBlank ? "?" : "";
                }

                json tileJson;
                tileJson["letter"] = letterText;
                tileJson["isBlank"] = tileBlank;
                tileJson["points"] = tileBlank ? 0 : alphabetParams->score(baseLetter);
                tileJson["row"] = rr;
                tileJson["col"] = cc;
                tiles.push_back(tileJson);
                primaryWord += letterText;
              }

              // Advance along the word path for next character
              adv(rr, cc);
            }
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
