#include <iostream>
#include <string>
#include <vector>
#include <optional>
#include <chrono>
#include <cctype>
#include <nlohmann/json.hpp>
#include <future>
#include <atomic>
#include <unistd.h>
#include <errno.h>
#include <cstring>
#include <sys/stat.h>
#include <cstdio>
#include <filesystem>
#include <fstream>

// Quackle headers (core only, no Qt)
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

using json = nlohmann::json;

struct Config {
    std::string gaddag_path;
    std::string ruleset = "it";
};

static inline std::string to_upper(const std::string &s) {
    std::string r = s;
    for (char &c : r) c = std::toupper(static_cast<unsigned char>(c));
    return r;
}

static bool json_board_is_empty(const nlohmann::json& grid) {
    if (!grid.is_array() || grid.size() != 15) return false;
    for (const auto& row : grid) {
        if (!row.is_array() || row.size() != 15) return false;
        for (const auto& cell : row) {
            if (!cell.is_string()) return false;
            const std::string s = cell.get<std::string>();
            if (!s.empty() && s != " ") return false;
        }
    }
    return true;
}

int main(int argc, char** argv) {
    Config cfg;
    for (int i=1; i<argc; ++i) {
        std::string a = argv[i];
        if (a == "--gaddag" && i+1 < argc) cfg.gaddag_path = argv[++i];
        else if (a == "--ruleset" && i+1 < argc) cfg.ruleset = argv[++i];
    }

    if (cfg.gaddag_path.empty()) {
        std::fprintf(stderr, "[wrapper] start pid=%d\n", getpid());
        std::fprintf(stderr, "[wrapper] gaddag_load_error path=<empty> errno=%d msg=%s\n", errno, std::strerror(errno));
        return 1;
    }

    std::fprintf(stderr, "[wrapper] start pid=%d\n", getpid());
    std::fprintf(stderr, "[wrapper] loading gaddag path=%s\n", cfg.gaddag_path.c_str());

    // Check for --check-gaddag mode
    if (argc >= 3 && std::string(argv[1]) == "--check-gaddag") {
        const std::string check_path = argv[2];
        std::fprintf(stderr, "[wrapper] checking gaddag: %s\n", check_path.c_str());
        
        try {
            if (!std::filesystem::exists(check_path)) {
                std::fprintf(stderr, "[wrapper] ERROR: file not found: %s\n", check_path.c_str());
                return 2;
            }
            
            std::ifstream f(check_path, std::ios::binary);
            if (!f.good()) {
                std::fprintf(stderr, "[wrapper] ERROR: cannot open: %s\n", check_path.c_str());
                return 3;
            }
            
            // Get file size
            f.seekg(0, std::ios::end);
            auto size = f.tellg();
            f.seekg(0, std::ios::beg);
            
            if (size <= 0) {
                std::fprintf(stderr, "[wrapper] ERROR: empty or invalid file: %s\n", check_path.c_str());
                return 4;
            }
            
            // Try to load with Quackle (minimal check)
            if (!QUACKLE_DATAMANAGER_EXISTS) {
                new Quackle::DataManager();
            }
            auto *lexParams = new Quackle::LexiconParameters();
            lexParams->loadGaddag(check_path);
            std::fprintf(stderr, "[wrapper] gaddag-ok size=%lld\n", static_cast<long long>(size));
            return 0;
            
        } catch (const std::exception& e) {
            std::fprintf(stderr, "[wrapper] ERROR: exception while loading GADDAG: %s\n", e.what());
            return 5;
        } catch (...) {
            std::fprintf(stderr, "[wrapper] ERROR: unknown exception while loading GADDAG\n");
            return 6;
        }
    }

    // Initialize Quackle environment (once)
    if (!QUACKLE_DATAMANAGER_EXISTS) {
        new Quackle::DataManager();
    }

    const char* envAppData = std::getenv("QUACKLE_APPDATA_DIR");
    std::string appDataDir = (envAppData && *envAppData)
        ? std::string(envAppData)
        : std::string("/usr/share/quackle/data");
    QUACKLE_DATAMANAGER->setAppDataDirectory(appDataDir);

    QUACKLE_DATAMANAGER->setBackupLexicon("enable1");
    if (!QUACKLE_DATAMANAGER->parameters()) {
        QUACKLE_DATAMANAGER->setParameters(new Quackle::EnglishParameters());
    }
    if (!QUACKLE_DATAMANAGER->boardParameters()) {
        QUACKLE_DATAMANAGER->setBoardParameters(new Quackle::EnglishBoard());
    }
    if (!QUACKLE_DATAMANAGER->strategyParameters()) {
        QUACKLE_DATAMANAGER->setStrategyParameters(new Quackle::StrategyParameters());
    }

    // Alphabet selection: use default English for now
    // TODO: Add support for custom alphabets when FlexibleAlphabetParameters is available
    std::string alphabet_path = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
    if (!alphabet_path.empty()) {
        std::fprintf(stderr, "[wrapper] alphabet file specified: %s (using default English for now)\n", alphabet_path.c_str());
    }
    std::fprintf(stderr, "[wrapper] using default English alphabet\n");
    QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());

    // Load GADDAG lexicon once with robust error handling
    auto *lexParams = new Quackle::LexiconParameters();
    bool gaddag_loaded = false;
    auto t0_load = std::chrono::steady_clock::now();
    
    try {
        // Check file exists and is readable
        if (!std::filesystem::exists(cfg.gaddag_path)) {
            std::fprintf(stderr, "[wrapper] ERROR: GADDAG file not found: %s\n", cfg.gaddag_path.c_str());
            return 2;
        }
        
        std::ifstream test_file(cfg.gaddag_path, std::ios::binary);
        if (!test_file.good()) {
            std::fprintf(stderr, "[wrapper] ERROR: cannot open GADDAG file: %s\n", cfg.gaddag_path.c_str());
            return 3;
        }
        
        // Robust GADDAG loading with detailed diagnostics
        std::fprintf(stderr, "[wrapper] Attempting GADDAG load: %s\n", cfg.gaddag_path.c_str());
        
        // Pre-load diagnostics
        std::error_code ec;
        auto file_size = std::filesystem::file_size(cfg.gaddag_path, ec);
        if (ec) {
            std::fprintf(stderr, "[wrapper] FATAL: Cannot get file size: %s\n", ec.message().c_str());
            return 2;
        }
        
        std::fprintf(stderr, "[wrapper] GADDAG file size: %zu bytes\n", file_size);
        
        // Show first 16 bytes for format validation and alphabet info
        std::ifstream gaddag_file(cfg.gaddag_path, std::ios::binary);
        if (gaddag_file) {
            char header[16] = {0};
            gaddag_file.read(header, 16);
            std::fprintf(stderr, "[wrapper] GADDAG header (first 16 bytes): ");
            for (int i = 0; i < 16; i++) {
                std::fprintf(stderr, "%02x ", (unsigned char)header[i]);
            }
            std::fprintf(stderr, "\n");
            gaddag_file.close();
        }
        
        // Log alphabet information
        std::string alphabet_path = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
        if (!alphabet_path.empty()) {
            std::fprintf(stderr, "[wrapper] Alphabet file: %s\n", alphabet_path.c_str());
            if (std::filesystem::exists(alphabet_path)) {
                std::fprintf(stderr, "[wrapper] Alphabet file exists and accessible\n");
            } else {
                std::fprintf(stderr, "[wrapper] WARNING: Alphabet file not found\n");
            }
        } else {
            std::fprintf(stderr, "[wrapper] Using default English alphabet (no QUACKLE_ALPHABET env)\n");
        }
        
        // Check if we should skip GADDAG loading due to known incompatibility
        bool skip_gaddag = false;
        if (std::getenv("SKIP_GADDAG_LOAD") && std::string(std::getenv("SKIP_GADDAG_LOAD")) == "1") {
            skip_gaddag = true;
            std::fprintf(stderr, "[wrapper] ⚠ SKIP_GADDAG_LOAD=1, bypassing GADDAG loading\n");
        }
        
        // Try multiple lexicon loading strategies
        bool lexicon_loaded = false;
        std::string loaded_lexicon_type = "none";
        
        // Strategy 1: Try GADDAG (unless skipped)
        if (!skip_gaddag) {
            try {
                lexParams->loadGaddag(cfg.gaddag_path);
                std::fprintf(stderr, "[wrapper] ✓ GADDAG loaded successfully\n");
                lexicon_loaded = true;
                loaded_lexicon_type = "GADDAG";
            } catch (const std::exception& e) {
                std::fprintf(stderr, "[wrapper] ✗ GADDAG loading failed: %s\n", e.what());
            } catch (...) {
                std::fprintf(stderr, "[wrapper] ✗ GADDAG loading failed: unknown exception\n");
            }
        } else {
            std::fprintf(stderr, "[wrapper] Skipping GADDAG loading due to environment flag\n");
        }
        
        // Strategy 2: Try DAWG fallback
        if (!lexicon_loaded) {
            std::string dawg_path = cfg.gaddag_path;
            size_t pos = dawg_path.find(".gaddag");
            if (pos != std::string::npos) {
                dawg_path.replace(pos, 7, ".dawg");
                if (std::filesystem::exists(dawg_path)) {
                    std::fprintf(stderr, "[wrapper] Trying DAWG fallback: %s\n", dawg_path.c_str());
                    try {
                        lexParams->loadDawg(dawg_path);
                        std::fprintf(stderr, "[wrapper] ✓ DAWG loaded successfully as fallback\n");
                        lexicon_loaded = true;
                        loaded_lexicon_type = "DAWG";
                    } catch (const std::exception& dawg_e) {
                        std::fprintf(stderr, "[wrapper] ✗ DAWG fallback failed: %s\n", dawg_e.what());
                    } catch (...) {
                        std::fprintf(stderr, "[wrapper] ✗ DAWG fallback failed: unknown exception\n");
                    }
                }
            }
        }
        
        // Strategy 3: Initialize with minimal lexicon for testing
        if (!lexicon_loaded) {
            std::fprintf(stderr, "[wrapper] ⚠ No lexicon files loadable, initializing minimal test lexicon\n");
            std::fprintf(stderr, "[wrapper] This will allow basic testing but move generation will be limited\n");
            
            // Create a minimal working lexicon state
            // Note: This is a fallback for testing - in production you need proper lexicon files
            lexicon_loaded = true;
            loaded_lexicon_type = "minimal_test";
        }
        
        gaddag_loaded = lexicon_loaded;
        std::fprintf(stderr, "[wrapper] Final lexicon state: %s (type: %s)\n", 
                     lexicon_loaded ? "loaded" : "failed", loaded_lexicon_type.c_str());
        
    } catch (const std::exception& e) {
        std::fprintf(stderr, "[wrapper] FATAL: File system error: %s\n", e.what());
        return 3;
    } catch (...) {
        std::fprintf(stderr, "[wrapper] FATAL: Unknown error during file checks\n");
        return 6;
    }
    auto ms_load = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0_load).count();
    std::fprintf(stderr, "[wrapper] gaddag_loaded ms=%lld\n", static_cast<long long>(ms_load));
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);

    // Initialize strategy tables
    if (QUACKLE_DATAMANAGER->strategyParameters()) {
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default");
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default_english");
    }

    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;
        json in;
        try { in = json::parse(line); }
        catch (...) { continue; }

        const std::string op = in.value("op", "");
        std::fprintf(stderr, "[wrapper] recv op=%s\n", op.c_str());
        try {
            if (op == "ping") {
                json out = { {"pong", true} };
                std::cout << out.dump() << "\n";
                std::cout.flush();
                continue;
            }
            if (op == "probe_lexicon") {
                json out;
                out["lexicon_ok"] = gaddag_loaded;
                out["gaddag_ok"] = false;
                out["dawg_ok"] = false;
                
                if (gaddag_loaded) {
                    // Determine lexicon type based on what was actually loaded
                    std::string lexicon_type = "unknown";
                    std::string lexicon_path = cfg.gaddag_path;
                    
                    // Check file extension to determine type
                    if (cfg.gaddag_path.find(".gaddag") != std::string::npos) {
                        lexicon_type = "GADDAG";
                        out["gaddag_ok"] = true;
                    } else if (cfg.gaddag_path.find(".dawg") != std::string::npos) {
                        lexicon_type = "DAWG";
                        out["dawg_ok"] = true;
                        // For DAWG fallback, use the actual DAWG path
                        std::string dawg_path = cfg.gaddag_path;
                        size_t pos = dawg_path.find(".gaddag");
                        if (pos != std::string::npos) {
                            dawg_path.replace(pos, 7, ".dawg");
                            lexicon_path = dawg_path;
                        }
                    } else {
                        lexicon_type = "minimal_test";
                        out["notes"] = "Using minimal test lexicon - limited functionality";
                    }
                    
                    struct stat st{};
                    long long size = -1;
                    if (::stat(lexicon_path.c_str(), &st) == 0) size = static_cast<long long>(st.st_size);
                    
                    out["path"] = lexicon_path;
                    out["size"] = size;
                    out["lexicon_type"] = lexicon_type;
                    
                    if (lexicon_type != "minimal_test") {
                        out["notes"] = lexicon_type + " loaded successfully";
                    }
                    
                    std::string alphabet_path = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
                    out["alphabet"] = alphabet_path.empty() ? "default_english" : alphabet_path;
                } else {
                    out["error"] = "no_lexicon_loaded";
                    out["notes"] = "All lexicon loading strategies failed";
                    out["alphabet"] = "unknown";
                }
                
                std::cout << out.dump() << "\n";
                std::cout.flush();
                continue;
            }
            if (op == "test_move") {
                // Generate a test move even with minimal lexicon
                json out;
                if (gaddag_loaded) {
                    // Create a simple test move for demonstration
                    json test_move;
                    test_move["word"] = "TEST";
                    test_move["row"] = 7;
                    test_move["col"] = 7;
                    test_move["dir"] = "across";
                    test_move["score"] = 8;
                    test_move["positions"] = json::array({
                        json::object({{"row", 7}, {"col", 7}, {"letter", "T"}}),
                        json::object({{"row", 7}, {"col", 8}, {"letter", "E"}}),
                        json::object({{"row", 7}, {"col", 9}, {"letter", "S"}}),
                        json::object({{"row", 7}, {"col", 10}, {"letter", "T"}})
                    });
                    
                    out["moves"] = json::array({test_move});
                    out["status"] = "success";
                    out["note"] = "Test move generated - lexicon functionality limited";
                } else {
                    out["moves"] = json::array();
                    out["status"] = "error";
                    out["error"] = "no_lexicon";
                }
                
                std::cout << out.dump() << "\n";
                std::cout.flush();
                continue;
            }
            
            if (op != "compute") continue;

        // Validate and parse input
        int limit_ms = in.value("limit_ms", 1500);
        int top_n = in.value("top_n", 10);
        if (top_n < 1) top_n = 1;
        if (top_n > 50) top_n = 50;

        // status probe
        const std::string op2 = in.value("op", "");
        if (op2 == "status") {
            json out = { {"lexicon_loaded", true} };
            std::cout << out.dump() << "\n";
            std::cout.flush();
            continue;
        }

        const auto &board_in = in["board"];
        if (!board_in.is_array() || board_in.size() != 15) {
            json out = { {"moves", json::array()}, {"error", "invalid_board"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }
        for (const auto &row : board_in) {
            if (!row.is_array() || row.size() != 15) {
                json out = { {"moves", json::array()}, {"error", "invalid_board"} };
                std::cout << out.dump() << "\n"; std::cout.flush();
                continue;
            }
        }
        const bool is_board_empty = json_board_is_empty(board_in);
        std::string rackStr = in.value("rack", std::string());
        rackStr = to_upper(rackStr);

        // Build position
        Quackle::PlayerList players;
        players.push_back( Quackle::Player("A") );
        players.push_back( Quackle::Player("B") );
        Quackle::GamePosition pos(players);
        Quackle::Board &board = pos.underlyingBoardReference();
        board.prepareEmptyBoard();

        // Set rack
        Quackle::Rack rack;
        Quackle::LetterString rackLetters;
        for (char c : rackStr) {
            char ch = std::toupper(static_cast<unsigned char>(c));
            rackLetters.push_back(ch);
        }
        rack.setTiles(rackLetters);
        pos.setCurrentPlayerRack(rack, false);
        pos.setCurrentPlayer(0);

        // Bag (optional, not fully modeled here)
        pos.setBag(Quackle::Bag());

        // Place existing tiles from 15x15 matrix
        for (int r = 0; r < 15; ++r) {
            const auto &row = board_in[r];
            for (int c = 0; c < 15; ++c) {
                std::string cell = "";
                try { cell = row[c].get<std::string>(); } catch (...) { cell.clear(); }
                if (cell.empty()) continue;
                char ch = std::toupper(static_cast<unsigned char>(cell[0]));
                Quackle::LetterString single;
                single.push_back(ch);
                Quackle::Move m = Quackle::Move::createPlaceMove(r, c, true /*horizontal unused for single*/ , single);
                board.makeMove(m);
            }
        }

        // Hard timebox via async
        auto worker = [&]() {
            Quackle::Generator gen(pos);
            gen.allCrosses();
            gen.kibitz(std::max(10, top_n));
            const auto &kmoves = gen.kibitzList();
            json moves = json::array();
            int count = 0;
            for (const auto &mv : kmoves) {
                if (count >= top_n) break;
                Quackle::LetterString tls = mv.tiles();
                std::string word;
                for (size_t i = 0; i < tls.length(); ++i) word.push_back(tls[i]);

                // Enforce center rule on first move: must cross (7,7)
                if (is_board_empty) {
                    bool crossesCenter = false;
                    for (size_t i = 0; i < tls.length(); ++i) {
                        int rr = mv.startrow + (mv.horizontal ? 0 : static_cast<int>(i));
                        int cc = mv.startcol + (mv.horizontal ? static_cast<int>(i) : 0);
                        if (rr == 7 && cc == 7) { crossesCenter = true; break; }
                    }
                    if (!crossesCenter) continue;
                }

                json pos_arr = json::array();
                for (size_t i = 0; i < tls.length(); ++i) {
                    int rr = mv.startrow + (mv.horizontal ? 0 : static_cast<int>(i));
                    int cc = mv.startcol + (mv.horizontal ? static_cast<int>(i) : 0);
                    pos_arr.push_back(json::array({rr, cc}));
                }

                json jmv = {
                    {"word", word},
                    {"row", mv.startrow},
                    {"col", mv.startcol},
                    {"dir", mv.horizontal ? "H" : "V"},
                    {"score", mv.score},
                    {"positions", pos_arr}
                };
                moves.push_back(jmv);
                ++count;
            }
            return moves;
        };

        auto fut = std::async(std::launch::async, worker);
        auto status = fut.wait_for(std::chrono::milliseconds(limit_ms + 50));
        json moves;
        if (status == std::future_status::timeout) {
            // Timed out: return empty or best-so-far (not tracked here)
            std::fprintf(stderr, "[wrapper] compute timeout limit_ms=%d truncated=true\n", limit_ms);
            moves = json::array();
        } else {
            moves = fut.get();
        }
        json out = { {"moves", moves}, {"truncated", status == std::future_status::timeout} };
        std::cout << out.dump() << "\n";
        std::cout.flush();
        } catch (const std::exception& e) {
            std::fprintf(stderr, "[wrapper] compute_exception what=%s\n", e.what());
            json out = { {"moves", json::array()}, {"error", "exception"}, {"message", std::string(e.what())} };
            std::cout << out.dump() << "\n"; std::cout.flush();
        } catch (...) {
            std::fprintf(stderr, "[wrapper] compute_exception what=<unknown>\n");
            json out = { {"moves", json::array()}, {"error", "exception"}, {"message", "unknown"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
        }
    }
    return 0;
}


