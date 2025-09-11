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
// #include "debug/memwrap.h"  // Disabled

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
            // Check if cell is not null (empty) and not empty string
            if (!cell.is_null()) {
                if (cell.is_string()) {
                    const std::string s = cell.get<std::string>();
                    if (!s.empty() && s != " ") return false;
                } else {
                    // Non-null, non-string cell means not empty
                    return false;
                }
            }
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

    // CRITICAL FIX: Force alphabet initialization FIRST, before any lexicon load
    std::string alphabet_path = std::getenv("QUACKLE_ALPHABET") ? std::getenv("QUACKLE_ALPHABET") : "";
    if (!alphabet_path.empty()) {
        std::fprintf(stderr, "[wrapper] alphabet file specified: %s\n", alphabet_path.c_str());
        if (!std::filesystem::exists(alphabet_path)) {
            std::fprintf(stderr, "[wrapper][fatal] QUACKLE_ALPHABET file not found: %s\n", alphabet_path.c_str());
            return 2;
        }
    } else {
        std::fprintf(stderr, "[wrapper] using default English alphabet (no QUACKLE_ALPHABET env)\n");
    }
    
    // Always use EnglishAlphabetParameters for consistent mapping
    QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());
    
    // Verify alphabet mapping is correct
    auto* alphabet = QUACKLE_DATAMANAGER->alphabetParameters();
    if (alphabet) {
        std::fprintf(stderr, "[wrapper] alphabet initialized: name=%s size=%d firstLetter=%d lastLetter=%d\n",
                alphabet->alphabetName().c_str(), alphabet->length(), 
                (int)alphabet->firstLetter(), (int)alphabet->lastLetter());
        
        // Verify A-Z mapping works correctly
        bool mapping_ok = true;
        for (char c = 'A'; c <= 'Z'; ++c) {
            // Convert ASCII to Quackle internal letter
            Quackle::Letter internal_letter = (Quackle::Letter)(c - 'A' + QUACKLE_FIRST_LETTER);
            if (internal_letter < alphabet->firstLetter() || internal_letter > alphabet->lastLetter()) {
                std::fprintf(stderr, "[wrapper][fatal] alphabet mapping OOB for '%c': internal=%d first=%d last=%d\n",
                        c, (int)internal_letter, (int)alphabet->firstLetter(), (int)alphabet->lastLetter());
                mapping_ok = false;
            }
        }
        if (mapping_ok) {
            std::fprintf(stderr, "[wrapper] alphabet mapping verified: A-Z -> %d-%d\n", 
                    (int)alphabet->firstLetter(), (int)alphabet->lastLetter());
        } else {
            std::fprintf(stderr, "[wrapper][fatal] alphabet mapping failed\n");
            return 2;
        }
    } else {
        std::fprintf(stderr, "[wrapper][fatal] failed to initialize alphabet\n");
        return 2;
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
    std::fprintf(stderr, "[wrapper] Initializing strategy parameters...\n");
    if (QUACKLE_DATAMANAGER->strategyParameters()) {
        std::fprintf(stderr, "[wrapper] Strategy parameters found, initializing...\n");
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default");
        std::fprintf(stderr, "[wrapper] Default strategy initialized\n");
        QUACKLE_DATAMANAGER->strategyParameters()->initialize("default_english");
        std::fprintf(stderr, "[wrapper] Default English strategy initialized\n");
    } else {
        std::fprintf(stderr, "[wrapper] No strategy parameters found\n");
    }

    std::fprintf(stderr, "[wrapper] Setting up I/O...\n");
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::fprintf(stderr, "[loop] entering main loop\n");
    std::string line;
    while (true) {
        if (!std::cin.good()) {
            std::fprintf(stderr, "[loop] cin !good (eof=%d fail=%d bad=%d) -> break\n",
                    (int)std::cin.eof(), (int)std::cin.fail(), (int)std::cin.bad());
            break;
        }
        if (!std::getline(std::cin, line)) {
            std::fprintf(stderr, "[loop] getline returned false (eof=%d fail=%d bad=%d) -> break\n",
                    (int)std::cin.eof(), (int)std::cin.fail(), (int)std::cin.bad());
            break;
        }
        std::fprintf(stderr, "[loop] got line len=%zu: %.*s\n", line.size(),
                (int)std::min<size_t>(line.size(), 200), line.c_str());

        if (line.empty()) {
            std::fprintf(stderr, "[loop] empty line -> continue\n");
            continue;
        }

        json in;
        try { 
            in = json::parse(line); 
            std::fprintf(stderr, "[loop] json parse ok\n");
        } catch (const nlohmann::json::parse_error& e) {
            std::fprintf(stderr, "[loop] json parse_error: %s; line len=%zu\n", e.what(), line.size());
            continue;
        } catch (const std::exception& e) {
            std::fprintf(stderr, "[loop] exception in parse: %s\n", e.what());
            continue;
        }

        auto opIt = in.find("op");
        if (opIt == in.end() || !opIt->is_string()) {
            std::fprintf(stderr, "[loop] parse ok but missing 'op' string -> continue\n");
            continue;
        }
        const std::string op = *opIt;
        std::fprintf(stderr, "[loop] op='%s'\n", op.c_str());
        try {
            if (op == "ping") {
                std::fprintf(stderr, "[loop] dispatch ping\n");
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
            
            if (op == "compute" || op == "move") {
                std::fprintf(stderr, "[loop] dispatch compute\n");
            } else {
                std::fprintf(stderr, "[loop] unknown op '%s'\n", op.c_str());
                continue;
            }

        // Validate and parse input
        std::fprintf(stderr, "[compute] raw rack=%s limit_ms=%d board_has=%d cells_len=%zu\n",
                in.contains("rack") && in["rack"].is_string() ? in["rack"].get_ref<const std::string&>().c_str() : "<none>",
                in.value("limit_ms", -1),
                (int)in.contains("board"),
                (in.contains("board") && in["board"].contains("cells") && in["board"]["cells"].is_array()) ? in["board"]["cells"].size() : 0);

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

        if (!in.contains("board") || !in["board"].is_object()) {
            std::fprintf(stderr, "[compute] invalid: missing board object\n");
            json out = { {"moves", json::array()}, {"error", "invalid_board"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }
        if (!in.contains("rack") || !in["rack"].is_string()) {
            std::fprintf(stderr, "[compute] invalid: rack must be string\n");
            json out = { {"moves", json::array()}, {"error", "invalid_rack"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }

        const auto &board_in = in["board"];
        if (!board_in.contains("cells") || !board_in["cells"].is_array() || board_in["cells"].size() != 15) {
            std::fprintf(stderr, "[compute] invalid: board.cells must be array of 15 rows\n");
            json out = { {"moves", json::array()}, {"error", "invalid_board"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }
        for (const auto &row : board_in["cells"]) {
            if (!row.is_array() || row.size() != 15) {
                json out = { {"moves", json::array()}, {"error", "invalid_board"} };
                std::cout << out.dump() << "\n"; std::cout.flush();
                continue;
            }
        }
        const bool is_board_empty = json_board_is_empty(board_in["cells"]);
        std::string rackStr = in.value("rack", std::string());
        rackStr = to_upper(rackStr);
        
        // Rack normalization (no ? into letters; count blanks)
        Quackle::FixedLengthString letters;
        int blanks = 0;
        for (unsigned char uc : rackStr) {
            char C = (char)std::toupper(uc);
            if (C == '?') { 
                ++blanks; 
                continue; 
            }
            if (C < 'A' || C > 'Z') { 
                std::fprintf(stderr, "[compute] invalid rack char=%u\n", (unsigned)uc); 
                json out = { {"moves", json::array()}, {"error", "invalid_rack_char"} };
                std::cout << out.dump() << "\n"; std::cout.flush();
                continue;
            }
            letters.push_back(C);
        }
        std::fprintf(stderr, "[compute] rack norm: letters_len=%zu blanks=%d\n", (size_t)letters.length(), blanks);
        
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
        players.push_back( Quackle::Player("A", 1, 0) );  // HumanPlayerType = 1
        players.push_back( Quackle::Player("B", 1, 1) );  // HumanPlayerType = 1
        Quackle::GamePosition pos(players);
        
        // Verify players are properly initialized
        std::fprintf(stderr, "[wrapper] players count: %zu\n", players.size());
        std::fprintf(stderr, "[wrapper] position players count: %zu\n", pos.players().size());
        std::fprintf(stderr, "[wrapper] position turnNumber: %d\n", pos.turnNumber());
        for (size_t i = 0; i < players.size(); i++) {
            std::fprintf(stderr, "[wrapper] player[%zu] id=%d name=%s\n", i, players[i].id(), players[i].name().c_str());
        }
        
        // CRITICAL FIX: Set current player to first player (0)
        if (!pos.setCurrentPlayer(0)) {
            std::fprintf(stderr, "[wrapper] ERROR: Failed to set current player to 0\n");
            json out = { {"moves", json::array()}, {"error", "internal_error"} };
            std::cout << out.dump() << "\n"; std::cout.flush();
            continue;
        }
        std::fprintf(stderr, "[wrapper] current player set to 0\n");
        std::fprintf(stderr, "[wrapper] position turnNumber after setCurrentPlayer: %d\n", pos.turnNumber());
        
        // Verify that currentPlayer() is accessible
        try {
            const Quackle::Player& currentPlayer = pos.currentPlayer();
            std::fprintf(stderr, "[wrapper] current player id: %d, name: %s\n", currentPlayer.id(), currentPlayer.name().c_str());
        } catch (const std::exception& e) {
            std::fprintf(stderr, "[wrapper] ERROR: Cannot access currentPlayer(): %s\n", e.what());
        }
        
        // CRITICAL FIX: Use setPosition() instead of copy constructor to avoid iterator issues
        std::fprintf(stderr, "[wrapper] using setPosition() to avoid copy constructor issues\n");
        
        Quackle::Board &board = pos.underlyingBoardReference();
        board.prepareEmptyBoard();

        // Set rack - SEPARATE blanks from letters to avoid OOB in counts
        Quackle::Rack rack;
        std::string rackLettersStr;
        int blankCount = 0;
        
        for (char c : rackStr) {
            char ch = std::toupper(static_cast<unsigned char>(c));
            if (ch == '?') {
                blankCount++; // count blanks separately
                continue; // DO NOT add '?' to rackLetters
            }
            if (ch < 'A' || ch > 'Z') {
                throw std::runtime_error("invalid rack tile: " + std::string(1, ch));
            }
            rackLettersStr.push_back(ch);
        }
        
        // CRITICAL FIX: Use alphabet encode to convert ASCII to internal letters
        auto* alphabet = QUACKLE_DATAMANAGER->alphabetParameters();
        if (!alphabet) {
            std::fprintf(stderr, "[wrapper] ERROR: alphabet not initialized\n");
            return json{{"error", "alphabet_not_initialized"}, {"moves", json::array()}};
        }
        
        Quackle::LetterString rackLetters = alphabet->encode(rackLettersStr);
        std::fprintf(stderr, "[wrapper] rack processing: letters=%u blanks=%d (encoded from '%s')\n", 
                (unsigned)rackLetters.size(), blankCount, rackLettersStr.c_str());
        
        // DEBUG: Log encoded letters
        std::fprintf(stderr, "[wrapper] DEBUG: encoded rack letters: ");
        for (size_t i = 0; i < rackLetters.size(); ++i) {
            std::fprintf(stderr, "[%zu]=%d ", i, (int)rackLetters[i]);
        }
        std::fprintf(stderr, "\n");
        
        rack.setTiles(rackLetters);
        
        // DEBUG: Verify rack was set correctly
        std::fprintf(stderr, "[wrapper] DEBUG: rack after setTiles: ");
        for (size_t i = 0; i < rack.tiles().size(); ++i) {
            std::fprintf(stderr, "[%zu]=%d ", i, (int)rack.tiles()[i]);
        }
        std::fprintf(stderr, "\n");
        
        // CRITICAL: Set watch range for memory operations
        std::fprintf(stderr, "[rack.watch] base=%p size=%zu tiles.len=%d\n", 
                &rack, sizeof(rack), (int)rack.tiles().length());
        // memwrap_set_watch_range(&rack, sizeof(rack));  // Disabled
        
        pos.setCurrentPlayerRack(rack, false);

        // Bag (optional, not fully modeled here)
        pos.setBag(Quackle::Bag());

        // Place existing tiles from 15x15 matrix with validation
        int board_tiles_placed = 0;
        for (int r = 0; r < 15; ++r) {
            const auto &row = board_in["cells"][r];
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
                // CRITICAL FIX: Use alphabet encode to convert ASCII to internal letters
                std::string singleStr(1, ch);
                Quackle::LetterString single = alphabet->encode(singleStr);
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

            Quackle::Generator gen;
            gen.setPosition(pos);
            
            // DEBUG: Verify the position has the correct rack
            const Quackle::Rack& currentRack = pos.currentPlayer().rack();
            std::fprintf(stderr, "[wrapper] DEBUG: position rack: ");
            for (size_t i = 0; i < currentRack.tiles().size(); ++i) {
                std::fprintf(stderr, "[%zu]=%d ", i, (int)currentRack.tiles()[i]);
            }
            std::fprintf(stderr, "\n");
            
            // CRITICAL FIX: Configure game parameters for scoring
            auto* gameParams = QUACKLE_DATAMANAGER->parameters();
            if (gameParams) {
                std::fprintf(stderr, "[wrapper] Game parameters configured\n");
            } else {
                std::fprintf(stderr, "[wrapper] WARNING: No game parameters found\n");
            }
            
            // CRITICAL FIX: Configure strategy parameters for scoring
            auto* strategyParams = QUACKLE_DATAMANAGER->strategyParameters();
            if (strategyParams) {
                std::fprintf(stderr, "[wrapper] Strategy parameters configured\n");
            } else {
                std::fprintf(stderr, "[wrapper] WARNING: No strategy parameters found\n");
            }
            
            // Verify alphabet consistency between Lexicon and Generator
            auto* alphabet = QUACKLE_DATAMANAGER->alphabetParameters();
            std::fprintf(stderr, "[wrapper] alphabet consistency check: alphabet=%p name=%s\n", 
                    (void*)alphabet, alphabet ? alphabet->alphabetName().c_str() : "null");
            
            // Log alphabet size for verification
            if (alphabet) {
                std::fprintf(stderr, "[wrapper] alphabet size: length=%d firstLetter=%d lastLetter=%d\n",
                        alphabet->length(), (int)alphabet->firstLetter(), (int)alphabet->lastLetter());
            }
            
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
            
            // CRITICAL FIX: Configure generator for scoring
            // The generator should use DataManager automatically
            // But let's verify the board has multipliers configured
            auto* boardParams = QUACKLE_DATAMANAGER->boardParameters();
            if (boardParams) {
                std::fprintf(stderr, "[wrapper] Board parameters configured\n");
            } else {
                std::fprintf(stderr, "[wrapper] WARNING: No board parameters found\n");
            }
            
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
                const auto &row = board_in["cells"][r];
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
            
            // About to call kibitz
            
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
                // CRITICAL FIX: Use alphabet userVisible to convert internal letters to ASCII
                std::string word = alphabet->userVisible(tls);
                
                // CRITICAL FIX: Force score calculation if score is 0
                int moveScore = mv.score;
                if (moveScore == 0 && !word.empty()) {
                    // Calculate score manually using the position
                    Quackle::Move scoredMove = mv;
                    pos.scoreMove(scoredMove);
                    moveScore = scoredMove.score;
                    std::fprintf(stderr, "[wrapper] DEBUG: Calculated score for %s: %d\n", word.c_str(), moveScore);
                }
                
                if (moveScore > top_score) {
                    top_score = moveScore;
                }

                // Enforce center rule on first move: must cross (7,7)
                if (is_board_empty) {
                    bool crossesCenter = false;
                    for (size_t i = 0; i < tls.length(); ++i) {
                        int rr = mv.startrow + (mv.horizontal ? 0 : static_cast<int>(i));
                        int cc = mv.startcol + (mv.horizontal ? static_cast<int>(i) : 0);
                        if (rr == 7 && cc == 7) { crossesCenter = true; break; }
                    }
                    if (!crossesCenter) { 
                        std::fprintf(stderr, "[wrapper] DEBUG: Skipping move %s (doesn't cross center)\n", word.c_str());
                        continue; 
                    }
                    std::fprintf(stderr, "[wrapper] DEBUG: Move %s crosses center - valid\n", word.c_str());
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
                    {"score", moveScore},
                    {"positions", pos_arr}
                };
                moves.push_back(jmv);
                ++count;
            }
            
            std::fprintf(stderr, "[wrapper] moves processed: %d, top_score: %d\n", count, top_score);
            return moves;
        };

        // CRITICAL FIX: Call worker() directly instead of using std::async to avoid copy constructor issues
        std::fprintf(stderr, "[wrapper] calling gen.kibitz() directly (no thread)\n");
        json moves = worker();
        auto elapsed_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - t_compute_start).count();
        json meta = {
            {"time_ms", static_cast<long long>(elapsed_ms)},
            {"board_empty", is_board_empty},
            {"truncated", false},  // No timeout since we're not using async
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


