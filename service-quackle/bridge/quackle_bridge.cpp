#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <memory>
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

static std::string arg(int argc, char** argv, const std::string& k, const std::string& d) {
  for (int i=1;i<argc-1;++i) if (std::string(argv[i])==k) return std::string(argv[i+1]);
  return d;
}
static int simsFor(const std::string& d){ if(d=="easy")return 0; if(d=="hard")return 800; return 300; }

int main(int argc, char** argv){
  const std::string lexicon = arg(argc, argv, "--lexicon", "en-enable");
  const std::string lexdir  = arg(argc, argv, "--lexdir",  "/usr/share/quackle/lexica");

  std::ostringstream ss; ss<<std::cin.rdbuf(); std::string input=ss.str();
  json req; try{ req = json::parse(input.empty()?"{}":input); }catch(...){
    std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true})"; return 0;
  }

  try{
    const json jboard = req.value("board", json::object());
    const json jrack  = req.value("rack",  json::array());
    const std::string diff = req.value("difficulty", std::string("medium"));
    (void)diff; // difficulty currently unused

    // Prepare data manager and lexicon
    QUACKLE_DATAMANAGER->setAppDataDirectory(lexdir);
    QUACKLE_DATAMANAGER->setBackupLexicon(lexicon);
    auto *alphabet = new Quackle::EnglishAlphabetParameters();
    QUACKLE_DATAMANAGER->setAlphabetParameters(alphabet);
    auto *lexParams = new Quackle::LexiconParameters();
    lexParams->loadGaddag(Quackle::LexiconParameters::findDictionaryFile(lexicon + ".gaddag"));
    QUACKLE_DATAMANAGER->setLexiconParameters(lexParams);

    // Build rack
    Quackle::Rack rr;
    Quackle::LetterString rackString;
    for (const auto &tile : jrack) {
        char ch = std::toupper(tile.value("letter","?")[0]);
        if (tile.value("isBlank", false)) ch = '?';
        rackString.push_back(ch);
    }
    rr.setTiles(rackString);

    // Create game position
    Quackle::PlayerList players;
    players.push_back( Quackle::Player("A") );
    players.push_back( Quackle::Player("B") );
    Quackle::GamePosition pos(players);
    Quackle::Board &board = pos.underlyingBoardReference();
    board.prepareEmptyBoard();
    pos.setCurrentPlayerRack(rr, false);

    // Place existing board tiles
    for (auto it = jboard.begin(); it != jboard.end(); ++it) {
      int r=0,c=0; char comma;
      std::istringstream sscoord(it.key()); sscoord>>r>>comma>>c;
      char ch = std::toupper(it->value("letter","?")[0]);
      if (it->value("isBlank", false)) ch = '?';
      Quackle::LetterString single;
      single.push_back(ch);
      Quackle::Move m = Quackle::Move::createPlaceMove(r, c, false, single);
      board.makeMove(m);
    }

    // Generate best move
    Quackle::Generator gen(pos);
    gen.kibitz(1);
    const auto &moves = gen.kibitzList();
    if (moves.empty()) {
      std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass"})"; return 0;
    }
    const Quackle::Move &best = moves.front();

    // Extract tiles
    json tiles = json::array();
    const Quackle::LetterString ls = best.tiles();
    const std::string word(ls.begin(), ls.end());
    int row = best.startrow;
    int col = best.startcol;
    for (size_t i=0;i<word.size();++i){
      char l = word[i];
      if (l == '.') { if (best.horizontal) ++col; else ++row; continue; }
      json jt; jt["row"]=row; jt["col"]=col;
      jt["letter"] = std::string(1, (l=='?'?'?':std::toupper(l)));
      jt["isBlank"] = (l=='?');
      jt["points"] = QUACKLE_ALPHABET_PARAMETERS->score(l);
      tiles.push_back(jt);
      if (best.horizontal) ++col; else ++row;
    }

    // Words formed
    json words = json::array();
    Quackle::MoveList formed = pos.allWordsFormedBy(best);
    for (const auto &w : formed){
      std::string ws;
      for (auto ch : w.wordTiles()) ws.push_back(static_cast<char>(ch));
      words.push_back(ws);
    }

    json out;
    out["score"]=best.score;
    out["tiles"]=tiles;
    out["words"]=words;
    out["move_type"]="place";
    std::cout<<out.dump(); return 0;
  }catch(const std::exception& e){
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error",std::string("engine: ")+e.what()}};
    std::cout<<out.dump(); return 0;
  }catch(...){
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error","engine: unknown"}};
    std::cout<<out.dump(); return 0;
  }
}

