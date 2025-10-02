// Helpers for building rack and serializing moves (behavior-preserving)
#pragma once

#include <set>
#include <utility>
#include <string>
#include "nlohmann/json.hpp"
#include "include/bridge_utils.hpp"

// Quackle headers
#include "alphabetparameters.h"
#include "rack.h"
#include "move.h"

using json = nlohmann::json;

// Build a Rack from normalized tiles vector of {char, isBlank}
// Returns true on success. On failure, sets errorCode.
inline bool build_rack_from_normalized(
  const std::vector<std::pair<char,bool>>& rackTilesNormalized,
  Quackle::AlphabetParameters* alphabetParams,
  Quackle::Rack& outRack,
  int& outEncodedLen,
  std::string& errorCode
) {
  outEncodedLen = 0;
  if (!alphabetParams) {
    errorCode = "alphabet_unavailable";
    return false;
  }
  Quackle::LetterString rackLetters;
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
      errorCode = "invalid_rack_letter";
      return false;
    }
    rackLetters.push_back(encoded[0]);
    debugLog("Rack tile: letter='" + std::string(1, letterChar) + "', encoded=" + std::to_string(static_cast<int>(encoded[0])));
  }
  outRack.setTiles(rackLetters);
  outEncodedLen = static_cast<int>(rackLetters.length());
  return true;
}

// Serialize a Place move into tiles/words arrays.
// Reconstructs placed tiles by walking along the path and excluding original board squares or '.' placeholders.
inline void serialize_place_move(
  const Quackle::Move& best,
  Quackle::AlphabetParameters* alphabetParams,
  const std::set<std::pair<int,int>>& originalBoardSquares,
  json& outTiles,
  json& outWords
) {
  outTiles = json::array();
  outWords = json::array();
  // Extract tiles (may be empty in some HL paths).
  // We PREFER tiles() because:
  //  - it encoda i passaggi su lettere già sulla board con '.' (così basta "saltare")
  //  - conserva le lettere assegnate ai blank tramite il casing (es. 'g' = blank 'G')
  // usedTiles() sostituisce i blank con QUACKLE_BLANK_MARK e quindi fa perdere la lettera assegnata.
  Quackle::LetterString tilesStr = best.tiles();
  Quackle::LetterString used = best.usedTiles();
  Quackle::LetterString seq = tilesStr.length() ? tilesStr : used;
  std::string primaryWord;
  primaryWord.reserve(seq.length());
  int startRow = best.startrow;
  int startCol = best.startcol;
  bool isHorizontal = best.horizontal;
  debugLog("Move details: startRow=" + std::to_string(startRow) + ", startCol=" + std::to_string(startCol) + ", isHorizontal=" + std::string(isHorizontal ? "true" : "false"));
  int rr = startRow;
  int cc = startCol;
  auto adv = [&](int &r, int &c) { if (isHorizontal) ++c; else ++r; };
  bool fallbackWordOnly = false;
  if (seq.length() == 0) {
    seq = best.wordTiles();
    fallbackWordOnly = true;
  }
  // No bounds adjustment here: emit raw 0-based coordinates from engine.
  // All normalization/validation happens in the service layer (Python).
  for (size_t i = 0; i < seq.length(); ++i) {
    Quackle::Letter tileValue = seq[i];
    // '.' nei tiles() indica lettera già sulla board → non emettere
    std::string uv = alphabetParams->userVisible(tileValue);
    bool isDotPlaceholder = (!uv.empty() && uv[0] == '.');
    bool playedThru = Quackle::Move::isAlreadyOnBoard(tileValue);
    bool occupied = originalBoardSquares.count({rr, cc}) > 0;
    if (!(isDotPlaceholder || playedThru || occupied)) {
      bool tileBlank = alphabetParams->isBlankLetter(tileValue) || tileValue == QUACKLE_BLANK_MARK;
      Quackle::Letter baseLetter = tileValue;
      if (alphabetParams->isBlankLetter(tileValue)) {
        baseLetter = alphabetParams->clearBlankness(tileValue);
      }
      // Per i blank, userVisible del baseLetter restituisce la lettera assegnata (maiuscola)
      std::string letterText = alphabetParams->userVisible(tileBlank ? baseLetter : tileValue);
      if (letterText.empty() || (letterText.size() == 1 && letterText[0] == '.')) {
        letterText = tileBlank ? "?" : "";
      }
      json tileJson;
      tileJson["letter"] = letterText;
      tileJson["isBlank"] = tileBlank;
      tileJson["points"] = tileBlank ? 0 : alphabetParams->score(baseLetter);
  // Emit raw coordinates; normalization is handled by the service layer if needed.
  tileJson["row"] = rr;
  tileJson["col"] = cc;
      outTiles.push_back(tileJson);
      primaryWord += letterText;
    }
    adv(rr, cc);
  }
  std::string mainWord = alphabetParams->userVisible(best.wordTiles());
  if (mainWord.empty()) mainWord = primaryWord;
  if (!mainWord.empty()) outWords.push_back(mainWord);
}
