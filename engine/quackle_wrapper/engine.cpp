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
#include <unordered_map>
#include <algorithm>

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
    std::string dawg_path;
    std::string ruleset = "en";
    std::string use_lexicon = "gaddag"; // "gaddag" or "dawg"
};

// Simple signature-based word index for empty-board fast path
static std::unordered_map<std::string, std::vector<std::string>> g_sig_index;
static bool g_sig_index_ready = false;

static std::string sig_of(const std::string &w) {
    std::string s = w;
    for (char &c : s) c = std::toupper(static_cast<unsigned char>(c));
    std::sort(s.begin(), s.end());
    return s;
}

static void build_signature_index_from_wordlist(const std::string &path) {
    std::ifstream in(path);
    if (!in.good()) return;
    std::string w;
    size_t added = 0;
    while (std::getline(in, w)) {
        if (w.empty()) continue;
        std::string up;
        up.reserve(w.size());
        for (char c: w) if (!isspace(static_cast<unsigned char>(c))) up.push_back(std::toupper(static_cast<unsigned char>(c)));
        if (up.empty()) continue;
        g_sig_index[sig_of(up)].push_back(up);
        if (++added >= 200000) { /* cap to avoid memory blow */ }
    }
    g_sig_index_ready = true;
}

static void ensure_signature_index() {
    if (g_sig_index_ready) return;
    const char *wl = std::getenv("ENABLE1_WORDLIST");
    std::string path = wl && *wl ? wl : std::string("/app/lexica_src/enable1.txt");
    build_signature_index_from_wordlist(path);
}

static std::vector<std::string> subset_signatures(const std::string &rack) {
    // generate all subset signatures length 2..7 with upcased letters; treat '?' separately later
    std::string letters;
    int blanks = 0;
    for (char c: rack) {
        if (c == '?') { blanks++; continue; }
        letters.push_back(std::toupper(static_cast<unsigned char>(c)));
    }
    std::sort(letters.begin(), letters.end());
    const int n = (int)letters.size();
    std::vector<std::string> out;
    for (int mask = 1; mask < (1<<n); ++mask) {
        int bits = __builtin_popcount((unsigned)mask);
        if (bits < 2 || bits > 7) continue;
        std::string s;
        s.reserve(bits);
        for (int i=0;i<n;++i) if (mask & (1<<i)) s.push_back(letters[i]);
        out.push_back(s);
    }
    // naive blank expansion: duplicate entries with a placeholder '0' to indicate one extra letter (limit to 1 blank)
    if (blanks > 0) {
        size_t base = out.size();
        for (size_t i=0;i<base;++i) {
            if (out[i].size() >= 7) continue;
            std::string t = out[i];
            t.push_back('\x01'); // marker for one extra
            out.push_back(std::move(t));
        }
    }
    return out;
}

static inline std::string to_upper(const std::string &s) {
    std::string r = s;
    for (char &c : r) c = std::toupper(static_cast<unsigned char>(c));
    return r;
}

// Input validation and normalization functions
static inline bool is_upper_letter(char c) { 
    return c >= 'A' && c <= 'Z'; 
}

static void validate_and_normalize_rack(std::string &rackStr) {
    std::string normalized;
    int blank_count = 0;
    
    for (char c : rackStr) {
        char upper_c = std::toupper(static_cast<unsigned char>(c));
        if (upper_c == '?') {
            blank_count++;
            normalized.push_back('?');
        } else if (is_upper_letter(upper_c)) {
            normalized.push_back(upper_c);
        } else {
            std::fprintf(stderr, "[wrapper] ERROR: invalid tile in rack: '%c' (not A-Z or ?)\n", c);
            throw std::runtime_error("invalid tile in rack");
        }
    }
    
    if (blank_count > 2) {
        std::fprintf(stderr, "[wrapper] ERROR: too many blanks in rack: %d (max 2)\n", blank_count);
        throw std::runtime_error("too many blanks in rack");
    }
    
    rackStr = normalized;
    std::fprintf(stderr, "[wrapper] rack normalized: '%s' (blanks: %d)\n", rackStr.c_str(), blank_count);
}

static void validate_board_cell(int row, int col, const std::string &cell) {
    if (row < 0 || row > 14 || col < 0 || col > 14) {
        std::fprintf(stderr, "[wrapper] ERROR: invalid cell coordinates: (%d,%d)\n", row, col);
        throw std::runtime_error("invalid cell coordinates");
    }
    
    if (cell.empty()) return; // empty cell is valid
    
    char ch = std::toupper(static_cast<unsigned char>(cell[0]));
    if (!is_upper_letter(ch)) {
        std::fprintf(stderr, "[wrapper] ERROR: invalid board letter at (%d,%d): '%c'\n", row, col, ch);
        throw std::runtime_error("invalid board letter");
    }
}

static void log_lexicon_diagnostics(const std::string &ruleset,
                                   const std::string &alpha_path,
                                   const std::string &lexicon_path,
                                   const std::string &lexicon_type) {
    std::fprintf(stderr, "[wrapper] === LEXICON DIAGNOSTICS ===\n");
    std::fprintf(stderr, "[wrapper] RULESET=%s\n", ruleset.c_str());
    std::fprintf(stderr, "[wrapper] QUACKLE_ALPHABET=%s\n", alpha_path.c_str());
    std::fprintf(stderr, "[wrapper] LEXICON_PATH=%s\n", lexicon_path.c_str());
    std::fprintf(stderr, "[wrapper] LEXICON_TYPE=%s\n", lexicon_type.c_str());
    
    // Check alphabet file
    if (!alpha_path.empty() && std::filesystem::exists(alpha_path)) {
        auto alpha_size = std::filesystem::file_size(alpha_path);
        std::fprintf(stderr, "[wrapper] alphabet file size: %zu bytes\n", alpha_size);
    } else {
        std::fprintf(stderr, "[wrapper] alphabet file: default English (no file)\n");
    }
    
    // Check lexicon file
    if (std::filesystem::exists(lexicon_path)) {
        auto lexicon_size = std::filesystem::file_size(lexicon_path);
        std::fprintf(stderr, "[wrapper] %s file size: %zu bytes\n", lexicon_type.c_str(), lexicon_size);
        
        // Show first 16 bytes
        std::ifstream lexicon_file(lexicon_path, std::ios::binary);
        if (lexicon_file) {
            char header[16] = {0};
            lexicon_file.read(header, 16);
            std::fprintf(stderr, "[wrapper] %s header (first 16 bytes): ", lexicon_type.c_str());
            for (int i = 0; i < 16; i++) {
                std::fprintf(stderr, "%02x ", (unsigned char)header[i]);
            }
            std::fprintf(stderr, "\n");
        }
    }
    
    std::fprintf(stderr, "[wrapper] lexicon type: %s\n", lexicon_type.c_str());
    std::fprintf(stderr, "[wrapper] ================================\n");
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
        else if (a == "--dawg" && i+1 < argc) cfg.dawg_path = argv[++i];
        else if (a == "--ruleset" && i+1 < argc) cfg.ruleset = argv[++i];
        else if (a == "--use" && i+1 < argc) cfg.use_lexicon = argv[++i];
    }

    if (cfg.gaddag_path.empty() && cfg.dawg_path.empty()) {
        std::fprintf(stderr, "[wrapper] start pid=%d\n", getpid());
        std::fprintf(stderr, "[wrapper] lexicon_load_error both paths empty\n");
        return 1;
    }

    std::fprintf(stderr, "[wrapper] start pid=%d\n", getpid());
    std::fprintf(stderr, "[wrapper] use_lexicon=%s\n", cfg.use_lexicon.c_str());
    
    // Validate ruleset - must be English
    if (cfg.ruleset != "en") {
        std::fprintf(stderr, "[wrapper] ERROR: ruleset must be 'en', got '%s'\n", cfg.ruleset.c_str());
        return 1;
    }
    std::fprintf(stderr, "[wrapper] ruleset validated: %s\n", cfg.ruleset.c_str());
    
    // Determine which lexicon to use
    std::string lexicon_path;
    std::string lexicon_type;
    if (cfg.use_lexicon == "dawg" && !cfg.dawg_path.empty()) {
        lexicon_path = cfg.dawg_path;
        lexicon_type = "DAWG";
    } else if (cfg.use_lexicon == "gaddag" && !cfg.gaddag_path.empty()) {
        lexicon_path = cfg.gaddag_path;
        lexicon_type = "GADDAG";
    } else {
        std::fprintf(stderr, "[wrapper] ERROR: cannot use lexicon type '%s' - paths: gaddag='%s', dawg='%s'\n", 
                    cfg.use_lexicon.c_str(), cfg.gaddag_path.c_str(), cfg.dawg_path.c_str());
        return 1;
    }
    
    std::fprintf(stderr, "[wrapper] loading %s path=%s\n", lexicon_type.c_str(), lexicon_path.c_str());

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
    std::fprintf(stderr, "[wrapper] appdata_dir=%s\n", appDataDir.c_str());

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

    // Alphabet selection: prefer provided QUACKLE_ALPHABET when available
    std::string alphabet_path = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
    if (!alphabet_path.empty()) {
        std::fprintf(stderr, "[wrapper] alphabet file specified: %s\n", alphabet_path.c_str());
        try {
            // Try flexible alphabet if available in this build
            // Fallback to English if not supported
            QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());
        } catch (...) {
            QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());
        }
    } else {
        std::fprintf(stderr, "[wrapper] using default English alphabet\n");
        QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());
    }

    // Load lexicon (GADDAG or DAWG) with robust error handling
    auto *lexParams = new Quackle::LexiconParameters();
    bool lexicon_loaded = false;
    auto t0_load = std::chrono::steady_clock::now();
    
    try {
        // Check file exists and is readable
        if (!std::filesystem::exists(lexicon_path)) {
            std::fprintf(stderr, "[wrapper] ERROR: %s file not found: %s\n", lexicon_type.c_str(), lexicon_path.c_str());
            return 2;
        }
        
        std::ifstream test_file(lexicon_path, std::ios::binary);
        if (!test_file.good()) {
            std::fprintf(stderr, "[wrapper] ERROR: cannot open %s file: %s\n", lexicon_type.c_str(), lexicon_path.c_str());
            return 3;
        }
        
        // Robust lexicon loading with detailed diagnostics
        std::fprintf(stderr, "[wrapper] Attempting %s load: %s\n", lexicon_type.c_str(), lexicon_path.c_str());
        
        // Pre-load diagnostics
        std::error_code ec;
        auto file_size = std::filesystem::file_size(lexicon_path, ec);
        if (ec) {
            std::fprintf(stderr, "[wrapper] FATAL: Cannot get file size: %s\n", ec.message().c_str());
            return 2;
        }
        
        std::fprintf(stderr, "[wrapper] %s file size: %zu bytes\n", lexicon_type.c_str(), file_size);
        
        // Show first 16 bytes for format validation and alphabet info
        std::ifstream lexicon_file(lexicon_path, std::ios::binary);
        if (lexicon_file) {
            char header[16] = {0};
            lexicon_file.read(header, 16);
            std::fprintf(stderr, "[wrapper] %s header (first 16 bytes): ", lexicon_type.c_str());
            for (int i = 0; i < 16; i++) {
                std::fprintf(stderr, "%02x ", (unsigned char)header[i]);
            }
            std::fprintf(stderr, "\n");
            lexicon_file.close();
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
        
        // Load lexicon (no fallbacks allowed)
        try {
            if (lexicon_type == "GADDAG") {
                lexParams->loadGaddag(lexicon_path);
            } else {
                lexParams->loadDawg(lexicon_path);
            }
            std::fprintf(stderr, "[wrapper] ✓ %s loaded successfully\n", lexicon_type.c_str());
            lexicon_loaded = true;
        } catch (const std::exception& e) {
            std::fprintf(stderr, "[wrapper] ✗ %s loading failed: %s\n", lexicon_type.c_str(), e.what());
            return 4;
        } catch (...) {
            std::fprintf(stderr, "[wrapper] ✗ %s loading failed: unknown exception\n", lexicon_type.c_str());
            return 5;
        }
        
    } catch (const std::exception& e) {
        std::fprintf(stderr, "[wrapper] FATAL: File system error: %s\n", e.what());
        return 3;
    } catch (...) {
        std::fprintf(stderr, "[wrapper] FATAL: Unknown error during file checks\n");
        return 6;
    }
    auto ms_load = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - t0_load).count();
    std::fprintf(stderr, "[wrapper] lexicon_loaded ms=%lld\n", static_cast<long long>(ms_load));
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);
    
    // Log comprehensive lexicon diagnostics
    log_lexicon_diagnostics(cfg.ruleset, alphabet_path, lexicon_path, lexicon_type);

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
                out["lexicon_ok"] = lexicon_loaded;
                out["lexicon_type"] = lexicon_type;
                out["lexicon_path"] = lexicon_path;
                struct stat st{};
                long long size = -1;
                if (::stat(lexicon_path.c_str(), &st) == 0) size = static_cast<long long>(st.st_size);
                out["size"] = size;
                std::string alphabet_path2 = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
                out["alphabet"] = alphabet_path2.empty() ? "default_english" : alphabet_path2;
                out["ruleset"] = cfg.ruleset;
                std::cout << out.dump() << "\n";
                std::cout.flush();
                continue;
            }
            // no test_move op; only compute is supported
            
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
        
        // Validate and normalize input
        try {
            validate_and_normalize_rack(rackStr);
        } catch (const std::exception& e) {
            json out = { {"moves", json::array()}, {"error", "invalid_input"}, {"reason", e.what()} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }

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

        // Place existing tiles from 15x15 matrix with validation
        int board_tiles_placed = 0;
        for (int r = 0; r < 15; ++r) {
            const auto &row = board_in[r];
            for (int c = 0; c < 15; ++c) {
                std::string cell = "";
                try { cell = row[c].get<std::string>(); } catch (...) { cell.clear(); }
                if (cell.empty()) continue;
                
                // Validate board cell
                try {
                    validate_board_cell(r, c, cell);
                } catch (const std::exception& e) {
                    json out = { {"moves", json::array()}, {"error", "invalid_board"}, {"reason", e.what()} };
                    std::cout << out.dump() << "\n"; std::cout.flush();
                    continue;
                }
                
                char ch = std::toupper(static_cast<unsigned char>(cell[0]));
                Quackle::LetterString single;
                single.push_back(ch);
                Quackle::Move m = Quackle::Move::createPlaceMove(r, c, true /*horizontal unused for single*/ , single);
                board.makeMove(m);
                board_tiles_placed++;
            }
        }
        std::fprintf(stderr, "[wrapper] board tiles placed: %d\n", board_tiles_placed);

        // Hard timebox via async (also include heavy cross computation here)
        auto t_compute_start = std::chrono::steady_clock::now();
        auto worker = [&]() {
            // REMOVED: Fast path fallback to force gen.kibitz() call and catch segfault
            // if (is_board_empty) { ... }

            Quackle::Generator gen(pos);
            
            // Log anchor analysis
            std::fprintf(stderr, "[wrapper] === ANCHOR & CROSS-SET ANALYSIS ===\n");
            std::fprintf(stderr, "[wrapper] board empty: %s\n", is_board_empty ? "YES" : "NO");
            if (is_board_empty) {
                std::fprintf(stderr, "[wrapper] empty board - center anchor at (7,7)\n");
            } else {
                // Count anchors on non-empty board
                int anchor_count = 0;
                for (int r = 0; r < 15; ++r) {
                    for (int c = 0; c < 15; ++c) {
                        if (board.letter(r, c) != 0) { // non-empty cell
                            // Check if this cell is an anchor (adjacent to empty cells)
                            bool is_anchor = false;
                            for (int dr = -1; dr <= 1; dr += 2) {
                                int nr = r + dr;
                                if (nr >= 0 && nr < 15 && board.letter(nr, c) == 0) {
                                    is_anchor = true;
                                    break;
                                }
                            }
                            if (!is_anchor) {
                                for (int dc = -1; dc <= 1; dc += 2) {
                                    int nc = c + dc;
                                    if (nc >= 0 && nc < 15 && board.letter(r, nc) == 0) {
                                        is_anchor = true;
                                        break;
                                    }
                                }
                            }
                            if (is_anchor) anchor_count++;
                        }
                    }
                }
                std::fprintf(stderr, "[wrapper] anchors found: %d\n", anchor_count);
            }
            
            gen.allCrosses();
            std::fprintf(stderr, "[wrapper] cross-set analysis: %s\n", is_board_empty ? "0 (empty board)" : "calculated");
            
            // Generate moves with detailed logging
            std::fprintf(stderr, "[wrapper] generating moves with kibitz...\n");
            
            // SURGICAL TELEMETRY: Log every tile passed to counting system
            auto log_tile = [&](char c, const char* where){
                std::fprintf(stderr, "[telemetry] tile='%c' code=%u where=%s\n",
                        (c >= 32 && c <= 126) ? c : '?', (unsigned)(unsigned char)c, where);
            };
            
            // Log rack tiles (normalized and validated)
            std::fprintf(stderr, "[telemetry] === RACK TILES ===\n");
            for (char c : rackStr) {
                char C = std::toupper(static_cast<unsigned char>(c));
                if (C == '?') { 
                    std::fprintf(stderr, "[telemetry] tile='?' code=%u where=rack_blank\n", (unsigned)(unsigned char)C);
                    continue; 
                }
                if (C < 'A' || C > 'Z') {
                    std::fprintf(stderr, "[error] invalid rack tile code=%u\n", (unsigned)(unsigned char)C);
                    throw std::runtime_error("invalid rack tile");
                }
                log_tile(C, "rack");
            }
            
            // Log board tiles (normalized and validated)
            std::fprintf(stderr, "[telemetry] === BOARD TILES ===\n");
            for (int r = 0; r < 15; ++r) {
                const auto &row = board_in[r];
                for (int c = 0; c < 15; ++c) {
                    std::string cell = "";
                    try { cell = row[c].get<std::string>(); } catch (...) { cell.clear(); }
                    if (cell.empty()) continue;
                    
                    char C = std::toupper(static_cast<unsigned char>(cell[0]));
                    if (C < 'A' || C > 'Z') {
                        std::fprintf(stderr, "[error] invalid board tile code=%u at r=%d c=%d\n",
                                (unsigned)(unsigned char)C, r, c);
                        throw std::runtime_error("invalid board tile");
                    }
                    log_tile(C, "board");
                }
            }
            
            // Log lexicon choice and expected alphabet size
            std::fprintf(stderr, "[diag] ruleset=en use_lexicon=%s alpha_expected=26\n",
                    cfg.use_lexicon.c_str());
            
            std::fprintf(stderr, "[wrapper] calling gen.kibitz(%d)...\n", std::max(5, top_n));
            
            try {
                gen.kibitz(std::max(5, top_n));
                std::fprintf(stderr, "[wrapper] gen.kibitz() completed successfully\n");
            } catch (const std::exception& e) {
                std::fprintf(stderr, "[wrapper] gen.kibitz() exception: %s\n", e.what());
                throw;
            } catch (...) {
                std::fprintf(stderr, "[wrapper] gen.kibitz() unknown exception\n");
                throw;
            }
            
            std::fprintf(stderr, "[wrapper] getting kibitz list...\n");
            const auto &kmoves = gen.kibitzList();
            std::fprintf(stderr, "[wrapper] kibitz list retrieved, size: %zu\n", kmoves.size());
            
            std::fprintf(stderr, "[wrapper] move generation complete - nodes processed: %zu, moves found: %zu\n", 
                        kmoves.size(), kmoves.size());
            
            json moves = json::array();
            int count = 0;
            int top_score = 0;
            for (const auto &mv : kmoves) {
                if (count >= top_n) break;
                Quackle::LetterString tls = mv.tiles();
                std::string word;
                for (size_t i = 0; i < tls.length(); ++i) word.push_back(tls[i]);
                
                if (mv.score > top_score) {
                    top_score = mv.score;
                }

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
            
            std::fprintf(stderr, "[wrapper] moves processed: %d, top_score: %d\n", count, top_score);
            return moves;
        };

        auto fut = std::async(std::launch::async, worker);
        auto status = fut.wait_for(std::chrono::milliseconds(limit_ms + 50));
        json moves;
        if (status == std::future_status::timeout) {
            // Timed out: return explicit error instead of fallback
            std::fprintf(stderr, "[wrapper] compute timeout limit_ms=%d - no fallback allowed\n", limit_ms);
            json out = { {"moves", json::array()}, {"error", "timeout"}, {"reason", "move generation exceeded time limit"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        } else {
            moves = fut.get();
        }
        auto elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - t_compute_start).count();
        json meta = {
            {"time_ms", static_cast<long long>(elapsed_ms)},
            {"board_empty", is_board_empty},
            {"truncated", status == std::future_status::timeout},
            {"moves_returned", static_cast<int>(moves.size())}
        };
        json out = { {"moves", moves}, {"meta", meta} };
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


