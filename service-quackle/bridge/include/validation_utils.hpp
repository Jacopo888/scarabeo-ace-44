// Tiny validation utilities for bridge input handling (no behavior changes)
#pragma once

#include <string>
#include <sstream>

inline bool is_upper_letter(char c) {
  return c >= 'A' && c <= 'Z';
}

// Parse a key like "row,col" into integers. Returns true on success.
inline bool parse_coord_key(const std::string& key, int& r, int& c) {
  std::istringstream ss(key);
  char comma;
  if (!(ss >> r >> comma >> c)) return false;
  return comma == ',';
}
