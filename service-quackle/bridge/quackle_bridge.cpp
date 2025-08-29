#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <nlohmann/json.hpp>
using json = nlohmann::json;

// Header Quackle (adatta i path se serve)
#include "game.h"
#include "board.h"
#include "rack.h"
#include "move.h"
#include "generator.h"
#include "evaluator.h"

static std::string arg(int argc, char** argv, const std::string& k, const std::string& d) {
  for (int i=1;i<argc-1;++i) if (std::string(argv[i])==k) return std::string(argv[i+1]);
  return d;
}
static int simsFor(const std::string& d){ if(d=="easy")return 0; if(d=="hard")return 800; return 300; }

static void jBoardToQ(const json& jb, Quackle::Board& b){
  for (auto it = jb.begin(); it != jb.end(); ++it){
    const std::string key = it.key(); int r=0,c=0; char comma;
    std::istringstream ss(key); ss>>r>>comma>>c;
    const auto& cell = it.value();
    std::string letter = cell.value("letter", "");
    bool isBlank = cell.value("isBlank", false);
    if (!letter.empty()){
      char L = std::toupper(letter[0]);
      if (isBlank) L='?';
      b.setTile(r,c,L);
    }
  }
}
static Quackle::Rack jRackToQ(const json& jr){
  Quackle::Rack rr;
  for (const auto& t: jr){
    std::string L = t.value("letter","");
    bool isBlank = t.value("isBlank",false);
    if(!L.empty()){
      char ch = std::toupper(L[0]);
      if(isBlank) ch='?';
      rr.add(ch);
    }
  }
  return rr;
}

int main(int argc, char** argv){
  const std::string lexicon = arg(argc, argv, "--lexicon", "en-enable");
  const std::string lexdir  = arg(argc, argv, "--lexdir",  "/usr/share/quackle/lexica");

  std::ostringstream ss; ss<<std::cin.rdbuf(); std::string input=ss.str();
  json req; try{ req = json::parse(input.empty()?"{}":input); }catch(...){
    std::cout << R"({"tiles":[],"score":0,"words":[],"move_type":"pass","engine_fallback":true})"; return 0;
  }
  const json jboard = req.value("board", json::object());
  const json jrack  = req.value("rack",  json::array());
  const std::string diff = req.value("difficulty", std::string("medium"));
  const int sims = simsFor(diff);

  try{
    Quackle::Game game;
    game.setLayout("scrabble");
    game.setLexicon(lexicon, lexdir);

    Quackle::Board qb; jBoardToQ(jboard, qb); game.setBoard(qb);
    Quackle::Rack rr = jRackToQ(jrack);      game.setRack(rr);

    Quackle::Move best = (sims>0) ? game.getBestMove(sims) : game.getBestMoveGreedy();

    json out; out["score"]=best.score(); out["move_type"]="place"; out["words"]=json::array();
    out["tiles"]=json::array();
    for (const auto& t : best.tiles()){
      json jt; jt["row"]=t.row(); jt["col"]=t.col();
      jt["letter"]=std::string(1,t.letter()); jt["points"]=t.points();
      jt["isBlank"]=(t.letter()=='?'); out["tiles"].push_back(jt);
    }
    std::cout<<out.dump(); return 0;
  }catch(const std::exception& e){
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error",std::string("engine: ")+e.what()}};
    std::cout<<out.dump(); return 0;
  }catch(...){
    json out={{"tiles",json::array()},{"score",0},{"words",json::array()},{"move_type","pass"},{"engine_fallback",true},{"error","engine: unknown"}};
    std::cout<<out.dump(); return 0;
  }
}
