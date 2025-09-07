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

    // Alphabet selection: default English
    QUACKLE_DATAMANAGER->setAlphabetParameters(new Quackle::EnglishAlphabetParameters());

    // Load GADDAG lexicon once
    auto *lexParams = new Quackle::LexiconParameters();
    bool gaddag_loaded = false;
    auto t0_load = std::chrono::steady_clock::now();
    try {
        lexParams->loadGaddag(cfg.gaddag_path);
        gaddag_loaded = true;
    } catch (...) {
        std::fprintf(stderr, "[wrapper] gaddag_load_error path=%s errno=%d msg=%s\n", cfg.gaddag_path.c_str(), errno, std::strerror(errno));
        return 1;
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
                if (gaddag_loaded) {
                    struct stat st{};
                    long long size = -1;
                    if (::stat(cfg.gaddag_path.c_str(), &st) == 0) size = static_cast<long long>(st.st_size);
                    json out = { {"lexicon_ok", true}, {"path", cfg.gaddag_path}, {"size", size} };
                    std::cout << out.dump() << "\n";
                    std::cout.flush();
                } else {
                    json out = { {"lexicon_ok", false}, {"error", "gaddag_not_loaded"} };
                    std::cout << out.dump() << "\n";
                    std::cout.flush();
                }
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


