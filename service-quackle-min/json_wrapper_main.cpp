// Versione custom del wrapper Quackle adattata all'API corrente (DataManager + GamePosition).
// Copiata nel clone durante la build Docker per sovrascrivere l'implementazione upstream.
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <map>
#include <cctype>
#include <optional>
#include <chrono>
#include <cstdlib>
#include <algorithm>
#include <sys/stat.h>
static bool file_exists(const std::string &p) { struct stat st{}; return ::stat(p.c_str(), &st) == 0 && S_ISREG(st.st_mode) && st.st_size > 0; }

struct StrategyStatus { bool ok{true}; std::vector<std::string> missing; };
static StrategyStatus validate_strategy_dir(const std::string &base) {
	StrategyStatus st; if (base.empty()) return st; const char *req[] = {
		"default_english/syn2","default_english/vcplace","default_english/superleaves","default_english/worths","default/bogowin"};
	for (auto &rel: req) { std::string full = base + "/" + rel; if (!file_exists(full)) { st.ok=false; st.missing.emplace_back(rel);} }
	return st; }

#include "datamanager.h"
#include "alphabetparameters.h"
#include "lexiconparameters.h"
#include "board.h"
#include "strategyparameters.h"
#include "game.h"
#include "move.h"
#include "rack.h"
#include "player.h"
#include "playerlist.h"
#include "generator.h"
#include "gameparameters.h"
#include "boardparameters.h"
#include "uv.h"
using namespace Quackle;

struct InputPayload { std::string op; std::string rack; std::map<std::pair<int,int>, std::pair<char,bool>> board; std::string lexicon; bool strategies{true}; int top_n{1}; };
static bool parse_coord_key(const std::string &k,int &r,int &c){auto p=k.find(','); if(p==std::string::npos) return false; try{r=std::stoi(k.substr(0,p)); c=std::stoi(k.substr(p+1));}catch(...){return false;} return r>=0&&r<15&&c>=0&&c<15; }
static std::string read_all_stdin(){ std::ostringstream o; o<<std::cin.rdbuf(); return o.str(); }
static bool parse_json_minimal(const std::string &raw, InputPayload &out){
	auto find_string=[&](const std::string &key)->std::optional<std::string>{std::string pat="\""+key+"\":"; size_t pos=raw.find(pat); if(pos==std::string::npos) return std::nullopt; pos+=pat.size(); while(pos<raw.size() && isspace((unsigned char)raw[pos])) pos++; if(pos>=raw.size()||raw[pos]!='"') return std::nullopt; ++pos; size_t end=raw.find('"',pos); if(end==std::string::npos) return std::nullopt; return raw.substr(pos,end-pos);};
	auto find_bool=[&](const std::string &key)->std::optional<bool>{std::string pat="\""+key+"\":"; size_t pos=raw.find(pat); if(pos==std::string::npos) return std::nullopt; pos+=pat.size(); while(pos<raw.size()&&isspace((unsigned char)raw[pos])) pos++; if(raw.compare(pos,4,"true")==0) return true; if(raw.compare(pos,5,"false")==0) return false; return std::nullopt;};
	auto find_int=[&](const std::string &key)->std::optional<int>{std::string pat="\""+key+"\":"; size_t pos=raw.find(pat); if(pos==std::string::npos) return std::nullopt; pos+=pat.size(); while(pos<raw.size()&&isspace((unsigned char)raw[pos])) pos++; size_t start=pos; if(pos<raw.size() && (raw[pos]=='-' || raw[pos]=='+')) pos++; while(pos<raw.size()&&isdigit((unsigned char)raw[pos])) pos++; if(pos==start || (pos==start+1 && (raw[start]=='-' || raw[start]=='+'))) return std::nullopt; try{return std::stoi(raw.substr(start,pos-start));}catch(...){return std::nullopt;}};
	auto opStr=find_string("op"); if(!opStr) return false; out.op=*opStr; if(auto r=find_string("rack")) out.rack=*r; if(auto lx=find_string("lexicon")) out.lexicon=*lx; else out.lexicon="enable1.15"; if(auto sb=find_bool("strategies")) out.strategies=*sb; else out.strategies=true; if(auto tn=find_int("top_n")) out.top_n=*tn; else if(auto lim=find_int("limit")) out.top_n=*lim; else if(auto n=find_int("n")) out.top_n=*n; if(out.top_n<1) out.top_n=1; if(out.top_n>10) out.top_n=10;
	size_t bpos=raw.find("\"board\""); if(bpos!=std::string::npos){ size_t brace=raw.find('{',bpos+7); if(brace!=std::string::npos){ int depth=0; size_t i=brace; size_t endObj=std::string::npos; for(;i<raw.size();++i){ if(raw[i]=='{') depth++; else if(raw[i]=='}'){ depth--; if(depth==0){ endObj=i; break; } } } if(endObj!=std::string::npos){ std::string obj=raw.substr(brace+1,endObj-brace-1); size_t pos=0; while(true){ size_t q1=obj.find('"',pos); if(q1==std::string::npos) break; size_t q2=obj.find('"',q1+1); if(q2==std::string::npos) break; std::string key=obj.substr(q1+1,q2-q1-1); pos=q2+1; size_t brace2=obj.find('{',pos); if(brace2==std::string::npos) break; int d2=0; size_t j=brace2; size_t vend=std::string::npos; for(;j<obj.size();++j){ if(obj[j]=='{') d2++; else if(obj[j]=='}'){ d2--; if(d2==0){ vend=j; break; } } } if(vend==std::string::npos) break; std::string vjson=obj.substr(brace2+1,vend-brace2-1); pos=vend+1; int rr,cc; if(!parse_coord_key(key,rr,cc)) continue; char letter='\0'; bool isBlank=false; size_t lpos=vjson.find("\"letter\""); if(lpos!=std::string::npos){ size_t cl=vjson.find('"',lpos+8); if(cl!=std::string::npos){ size_t cl2=vjson.find('"',cl+1); if(cl2!=std::string::npos && cl2>cl+1) letter=std::toupper((unsigned char)vjson[cl+1]); } } size_t bl=vjson.find("isBlank"); if(bl!=std::string::npos){ size_t bt=vjson.find("true",bl); if(bt!=std::string::npos) isBlank=true; } if(letter=='\0') continue; out.board[{rr,cc}]={letter,isBlank}; } } } }
	return true; }
static void print_error(const std::string &err){ std::cout << "{\"status\":\"error\",\"error\":\""<<err<<"\"}" << std::endl; }

// Configure standard Scrabble board (15x15) with center at (7,7) and classic multipliers.
static void configure_standard_board()
{
	BoardParameters *bp = QUACKLE_BOARD_PARAMETERS;
	if (!bp) return;
	// Dimensions and start (0-based)
	bp->setWidth(15);
	bp->setHeight(15);
	bp->setStartRow(7);
	bp->setStartColumn(7);

	// Letter multipliers (1=plain, 2=DL, 3=TL, 4=QL unused)
	const int letter_m[15][15] = {
		{1,1,1,2,1,1,1,1,1,1,1,2,1,1,1},
		{1,1,1,1,1,3,1,1,1,3,1,1,1,1,1},
		{1,1,1,1,1,1,2,1,2,1,1,1,1,1,1},
		{2,1,1,1,1,1,1,2,1,1,1,1,1,1,2},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{1,3,1,1,1,3,1,1,1,3,1,1,1,3,1},
		{1,1,2,1,1,1,2,1,2,1,1,1,2,1,1},
		{1,1,1,2,1,1,1,1,1,1,1,2,1,1,1},
		{1,1,2,1,1,1,2,1,2,1,1,1,2,1,1},
		{1,3,1,1,1,3,1,1,1,3,1,1,1,3,1},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{2,1,1,1,1,1,1,2,1,1,1,1,1,1,2},
		{1,1,1,1,1,1,2,1,2,1,1,1,1,1,1},
		{1,1,1,1,1,3,1,1,1,3,1,1,1,1,1},
		{1,1,1,2,1,1,1,1,1,1,1,2,1,1,1},
	};
	// Word multipliers (1=plain, 2=DW, 3=TW, 4=QW unused). Center (7,7) is DW=2.
	const int word_m[15][15] = {
		{3,1,1,1,1,1,1,3,1,1,1,1,1,1,3},
		{1,2,1,1,1,1,1,1,1,1,1,1,1,2,1},
		{1,1,2,1,1,1,1,1,1,1,1,1,2,1,1},
		{1,1,1,2,1,1,1,1,1,1,1,2,1,1,1},
		{1,1,1,1,2,1,1,1,1,1,2,1,1,1,1},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{3,1,1,1,1,1,1,2,1,1,1,1,1,1,3},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
		{1,1,1,1,2,1,1,1,1,1,2,1,1,1,1},
		{1,1,1,2,1,1,1,1,1,1,1,2,1,1,1},
		{1,1,2,1,1,1,1,1,1,1,1,1,2,1,1},
		{1,2,1,1,1,1,1,1,1,1,1,1,1,2,1},
		{3,1,1,1,1,1,1,3,1,1,1,1,1,1,3},
	};
	for (int r = 0; r < 15; ++r) {
		for (int c = 0; c < 15; ++c) {
			bp->setLetterMultiplier(r, c, static_cast<BoardParameters::LetterMultiplier>(letter_m[r][c]));
			bp->setWordMultiplier(r, c, static_cast<BoardParameters::WordMultiplier>(word_m[r][c]));
		}
	}
}

static std::string json_escape(const std::string &s)
{
	std::ostringstream out;
	for (char ch : s) {
		switch (ch) {
			case '\\': out << "\\\\"; break;
			case '"': out << "\\\""; break;
			case '\n': out << "\\n"; break;
			case '\r': out << "\\r"; break;
			case '\t': out << "\\t"; break;
			default: out << ch; break;
		}
	}
	return out.str();
}

static std::string uv_to_string(const UVString &uv)
{
	std::string out;
	out.reserve(uv.size());
	for (auto ch : uv) out.push_back((char)ch);
	return out;
}

static double move_equity(const Move &move)
{
	return move.equity == 0.0 ? (double)move.score : move.equity;
}

static std::string serialize_letter_array(const LetterString &letters)
{
	std::ostringstream out;
	out << "[";
	bool first = true;
	for (Letter internal : letters) {
		if (!first) out << ",";
		first = false;
		Letter plain = QUACKLE_ALPHABET_PARAMETERS->clearBlankness(internal);
		UVString vis = QUACKLE_ALPHABET_PARAMETERS->userVisible(plain);
		char outChar = vis.empty()? '?' : (char)vis[0];
		out << "\"" << outChar << "\"";
	}
	out << "]";
	return out.str();
}

static std::string serialize_move_fields(const Move &move, const Board &boardBefore, int rank, bool includeRank)
{
	std::ostringstream json;
	if (includeRank) json << "\"rank\":" << rank << ",";

	if (move.action == Move::Pass || move.action == Move::Nonmove) {
		json << "\"move_type\":\"pass\",\"score\":" << move.score << ",\"equity\":" << move_equity(move);
		return json.str();
	}

	if (move.action == Move::Exchange || move.action == Move::BlindExchange) {
		json << "\"move_type\":\"exchange\",\"score\":" << move.score << ",\"equity\":" << move_equity(move)
		     << ",\"exchange_letters\":" << serialize_letter_array(move.tiles())
		     << ",\"exchange_count\":" << move.tiles().length()
		     << ",\"exchange_blind\":" << (move.action == Move::BlindExchange ? "true" : "false");
		return json.str();
	}

	if (move.action != Move::Place) {
		json << "\"move_type\":\"pass\",\"score\":" << move.score << ",\"equity\":" << move_equity(move);
		return json.str();
	}

	std::ostringstream tilesJson;
	tilesJson << "[";
	bool firstOut = true;
	// usedTiles() contains only rack tiles; using it for coordinates shifts every tile after an anchor.
	LetterString moveTiles = move.tiles();
	LetterString fullWordTiles;
	for (int idx = 0; idx < (int)moveTiles.length(); ++idx) {
		int row = move.startrow + (move.horizontal ? 0 : idx);
		int col = move.startcol + (move.horizontal ? idx : 0);
		Letter internal = moveTiles[idx];
		if (Move::isAlreadyOnBoard(internal)) {
			Letter boardLetter = boardBefore.letter(row, col);
			if (boardLetter != QUACKLE_NULL_MARK)
				fullWordTiles += QUACKLE_ALPHABET_PARAMETERS->clearBlankness(boardLetter);
			continue;
		}
		fullWordTiles += QUACKLE_ALPHABET_PARAMETERS->clearBlankness(internal);
		bool isBlank = QUACKLE_ALPHABET_PARAMETERS->isBlankLetter(internal);
		Letter plain = QUACKLE_ALPHABET_PARAMETERS->clearBlankness(internal);
		int points = isBlank ? 0 : QUACKLE_ALPHABET_PARAMETERS->score(plain);
		UVString vis = QUACKLE_ALPHABET_PARAMETERS->userVisible(plain);
		char outChar = vis.empty()? '?' : (char)vis[0];
		if(!firstOut) tilesJson << ",";
		firstOut = false;
		tilesJson << "{\"row\":" << row
		          << ",\"col\":" << col
		          << ",\"letter\":\"" << outChar << "\""
		          << ",\"isBlank\":" << (isBlank ? "true" : "false")
		          << ",\"points\":" << points
		          << "}";
	}
	tilesJson << "]";

	UVString wordUV = QUACKLE_ALPHABET_PARAMETERS->userVisible(fullWordTiles);
	std::string word = uv_to_string(wordUV);
	std::string dir = move.horizontal ? "H" : "V";
	json << "\"move_type\":\"play\",\"score\":" << move.score << ",\"equity\":" << move_equity(move)
	     << ",\"start_row\":" << move.startrow << ",\"start_col\":" << move.startcol
	     << ",\"direction\":\"" << dir << "\",\"word\":\"" << json_escape(word) << "\""
	     << ",\"tiles\":" << tilesJson.str();
	return json.str();
}

int main(){ std::ios::sync_with_stdio(false); InputPayload payload; std::string raw=read_all_stdin(); if(!parse_json_minimal(raw,payload)){ print_error("invalid_json"); return 1;} if(payload.op!="best_move"){ print_error("unsupported_op"); return 1; }
	std::string rack; rack.reserve(payload.rack.size()); for(char ch: payload.rack){ if(ch=='?') rack.push_back('?'); else if(std::isalpha((unsigned char)ch)) rack.push_back(std::toupper((unsigned char)ch)); }
	try {
		std::string strategyDir; if(const char *envStrategy=getenv("QUACKLE_STRATEGY_DIR")) strategyDir=envStrategy; StrategyStatus stratStatus=validate_strategy_dir(strategyDir); if(!stratStatus.ok){ std::ostringstream err; err<<"strategy_missing:"; for(size_t i=0;i<stratStatus.missing.size();++i){ if(i) err<<','; err<<stratStatus.missing[i]; } print_error(err.str()); return 10; }
	DataManager dm; if(const char *appDir=getenv("QUACKLE_APPDATA_DIR")){ dm.setAppDataDirectory(appDir); dm.setUserDataDirectory(appDir);} const char *lexDirEnv=getenv("QUACKLE_LEXDIR"); std::string lexDir=lexDirEnv?lexDirEnv:"./lexica"; std::string lexicon=payload.lexicon.empty()?"enable1.15":payload.lexicon; std::string dawgPath=lexDir+"/"+lexicon+".dawg"; std::string gaddagPath=lexDir+"/"+lexicon+".gaddag"; if(!file_exists(dawgPath)){ print_error("missing_dawg"); return 11;} QUACKLE_LEXICON_PARAMETERS->loadDawg(dawgPath); if(file_exists(gaddagPath)) QUACKLE_LEXICON_PARAMETERS->loadGaddag(gaddagPath); QUACKLE_STRATEGY_PARAMETERS->initialize(lexicon);
	// Force standard board parameters (15x15, center at 7,7) before creating any Board
	configure_standard_board();
		Board board; board.prepareEmptyBoard(); for(const auto &kv: payload.board){ int r=kv.first.first; int c=kv.first.second; char letterChar=std::toupper((unsigned char)kv.second.first); bool isBlank=kv.second.second; UVString uvs; uvs.push_back(letterChar); LetterString enc=QUACKLE_ALPHABET_PARAMETERS->encode(uvs); if(!enc.length()) continue; Letter internal=enc[0]; if(isBlank) internal=QUACKLE_ALPHABET_PARAMETERS->setBlankness(internal); LetterString tileStr; tileStr+=internal; Move place=Move::createPlaceMove(r,c,true,tileStr); board.makeMove(place);} Board boardBefore=board;
		PlayerList players; players.push_back(Player(MARK_UV("P1"), Player::HumanPlayerType, 0)); Game game; game.setPlayers(players); game.addPosition(); game.currentPosition().setBoard(board); game.currentPosition().ensureBoardIsPreparedForAnalysis(); LetterString rackLetters; for(char ch: rack){ if(ch=='?') rackLetters+=QUACKLE_BLANK_MARK; else { UVString uvs; uvs.push_back(ch); LetterString enc=QUACKLE_ALPHABET_PARAMETERS->encode(uvs); if(enc.length()) rackLetters+=enc[0]; } } game.currentPosition().setCurrentPlayerRack(Rack(rackLetters));
		Generator gen(game.currentPosition()); gen.kibitz(50); const MoveList &list = gen.kibitzList(); if(list.empty()){ std::cout<<"{\"status\":\"ok\",\"move_type\":\"pass\",\"strategy_ok\":true,\"moves\":[]}"<<std::endl; return 0; }
		std::vector<const Move*> ranked; ranked.reserve(list.size()); for(const auto &mv: list) ranked.push_back(&mv);
		std::stable_sort(ranked.begin(), ranked.end(), [](const Move *a, const Move *b){ return move_equity(*a) > move_equity(*b); });
		const Move &best=*ranked.front();
		int bw = QUACKLE_BOARD_PARAMETERS ? QUACKLE_BOARD_PARAMETERS->width() : 15;
		int bh = QUACKLE_BOARD_PARAMETERS ? QUACKLE_BOARD_PARAMETERS->height() : 15;
		int bsR = QUACKLE_BOARD_PARAMETERS ? QUACKLE_BOARD_PARAMETERS->startRow() : 7;
		int bsC = QUACKLE_BOARD_PARAMETERS ? QUACKLE_BOARD_PARAMETERS->startColumn() : 7;
		int topLimit = payload.top_n; if(topLimit < 1) topLimit = 1; if(topLimit > 10) topLimit = 10; if(topLimit > (int)ranked.size()) topLimit = (int)ranked.size();
		std::ostringstream movesJson; movesJson << "[";
		for(int i=0; i<topLimit; ++i){ if(i) movesJson << ","; movesJson << "{" << serialize_move_fields(*ranked[i], boardBefore, i + 1, true) << "}"; }
		movesJson << "]";
		std::cout<<"{\"status\":\"ok\"," << serialize_move_fields(best, boardBefore, 0, false)
		 <<",\"engine_info\":{\"board\":{\"width\":"<<bw<<",\"height\":"<<bh<<",\"start_row\":"<<bsR<<",\"start_col\":"<<bsC<<"}}"
		 <<",\"strategy_ok\":true,\"moves\":"<<movesJson.str()<<"}"
		 <<std::endl; return 0;
	} catch(const std::exception &e){ print_error(std::string("exception:")+e.what()); return 2; } catch(...){ print_error("unknown_exception"); return 3; }
}
