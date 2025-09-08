#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct SimpleTile {
    std::string letter;
    int points;
    int row, col;
};

struct SimpleMove {
    std::vector<SimpleTile> tiles;
    int score;
    std::vector<std::string> words;
};

// Simple word generation based on common rack combinations
SimpleMove generateSimpleMove(const std::vector<std::string>& rack, const std::map<std::string, bool>& board) {
    SimpleMove move;
    
    // Simple heuristic: try to make common words from available tiles
    std::string rackString = "";
    for (const auto& tile : rack) {
        rackString += tile;
    }
    
    // Convert to uppercase for consistency
    for (auto& c : rackString) {
        c = std::toupper(c);
    }
    
    // Simple word patterns - real valid English words
    std::vector<std::pair<std::string, int>> commonWords = {
        {"ARE", 3}, {"EAR", 3}, {"ERA", 3}, {"ART", 3}, {"RAT", 3}, {"TAR", 3},
        {"CAR", 5}, {"CAT", 5}, {"ACE", 5}, {"CUT", 5}, {"CUE", 5},
        {"DOG", 5}, {"GOD", 5}, {"LOG", 4}, {"HOG", 7}, {"HAT", 6},
        {"THE", 6}, {"SET", 3}, {"TEN", 3}, {"NET", 3}, {"PET", 5},
        {"POT", 5}, {"TOP", 5}, {"OPT", 5}, {"LOT", 3}, {"TOO", 3},
        {"BOX", 12}, {"FOX", 13}, {"WAX", 13}, {"MAX", 12}, {"MIX", 12}
    };
    
    // Try to find a word we can make with the available tiles
    for (const auto& wordPair : commonWords) {
        std::string word = wordPair.first;
        int baseScore = wordPair.second;
        
        // Check if we can make this word with available tiles
        std::string tempRack = rackString;
        bool canMake = true;
        
        for (char c : word) {
            size_t pos = tempRack.find(c);
            if (pos != std::string::npos) {
                tempRack.erase(pos, 1);
            } else {
                canMake = false;
                break;
            }
        }
        
        if (canMake) {
            // Found a word we can make!
            move.score = baseScore;
            move.words.push_back(word);
            
            // Place tiles starting at center (8,8) if board is empty, otherwise adjacent to existing tiles
            int startRow = 8, startCol = 8;
            
            // If board is not empty, try to place adjacent to existing tile
            if (!board.empty()) {
                // Find first existing tile and place adjacent
                auto firstTile = board.begin();
                // Parse coordinate like "8,8"
                size_t comma = firstTile->first.find(',');
                if (comma != std::string::npos) {
                    startRow = std::stoi(firstTile->first.substr(0, comma));
                    startCol = std::stoi(firstTile->first.substr(comma + 1)) + 1; // Place to the right
                }
            }
            
            // Create tiles for the word
            for (size_t i = 0; i < word.length(); i++) {
                SimpleTile tile;
                tile.letter = std::string(1, word[i]);
                
                // Simple point values
                char c = word[i];
                switch (c) {
                    case 'A': case 'E': case 'I': case 'L': case 'N': case 'O': 
                    case 'R': case 'S': case 'T': case 'U': tile.points = 1; break;
                    case 'D': case 'G': tile.points = 2; break;
                    case 'B': case 'C': case 'M': case 'P': tile.points = 3; break;
                    case 'F': case 'H': case 'V': case 'W': case 'Y': tile.points = 4; break;
                    case 'K': tile.points = 5; break;
                    case 'J': case 'X': tile.points = 8; break;
                    case 'Q': case 'Z': tile.points = 10; break;
                    default: tile.points = 1; break;
                }
                
                tile.row = startRow;
                tile.col = startCol + i; // Place horizontally
                move.tiles.push_back(tile);
            }
            
            return move; // Return first word we can make
        }
    }
    
    // If no words found, return empty move (will be pass)
    return move;
}

int main(int argc, char** argv) {
    try {
        // Read JSON input from stdin
        std::string input;
        std::string line;
        while (std::getline(std::cin, line)) {
            input += line;
        }
        
        json req = json::parse(input.empty() ? "{}" : input);
        
        const json jboard = req.value("board", json::object());
        const json jrack = req.value("rack", json::array());
        
        // Convert board to simple format
        std::map<std::string, bool> board;
        for (auto it = jboard.begin(); it != jboard.end(); ++it) {
            board[it.key()] = true;
        }
        
        // Convert rack to simple format
        std::vector<std::string> rack;
        if (jrack.is_string()) {
            std::string rackStr = jrack.get<std::string>();
            for (char c : rackStr) {
                rack.push_back(std::string(1, std::toupper(c)));
            }
        } else if (jrack.is_array()) {
            for (const auto& tile : jrack) {
                std::string letter = tile.value("letter", "?");
                rack.push_back(std::string(1, std::toupper(letter[0])));
            }
        }
        
        // Generate move
        SimpleMove move = generateSimpleMove(rack, board);
        
        // Convert to JSON response
        json response;
        json tiles = json::array();
        
        if (!move.tiles.empty()) {
            for (const auto& tile : move.tiles) {
                json tileJson;
                tileJson["letter"] = tile.letter;
                tileJson["points"] = tile.points;
                tileJson["row"] = tile.row;
                tileJson["col"] = tile.col;
                tileJson["isBlank"] = false;
                tiles.push_back(tileJson);
            }
            
            response["tiles"] = tiles;
            response["score"] = move.score;
            response["words"] = move.words;
            response["move_type"] = "play";
            response["engine_fallback"] = false;
        } else {
            // No valid move found, pass
            response["tiles"] = json::array();
            response["score"] = 0;
            response["words"] = json::array();
            response["move_type"] = "pass";
            response["engine_fallback"] = true;
        }
        
        std::cout << response.dump() << std::endl;
        return 0;
        
    } catch (const std::exception& e) {
        json error_response = {
            {"tiles", json::array()},
            {"score", 0},
            {"words", json::array()},
            {"move_type", "pass"},
            {"engine_fallback", true},
            {"error", std::string("simple_bridge: ") + e.what()}
        };
        std::cout << error_response.dump() << std::endl;
        return 0;
    }
}
