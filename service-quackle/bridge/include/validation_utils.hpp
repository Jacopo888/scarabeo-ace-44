// Tiny validation utilities for bridge input handling (no behavior changes)
#pragma once

#include <string>
#include <sstream>

inline bool is_upper_letter(char c) {
  return c >= 'A' && c <= 'Z';
}

// Acceptable blank markers in inputs
inline bool is_blank_marker(char c) {
  return c == '?' || c == '*';
}

// After uppercasing, a rack char is valid if it's an A-Z letter or a blank marker
inline bool is_valid_rack_letter_or_blank(char c) {
  return is_upper_letter(c) || is_blank_marker(c);
}

// Parse a key like "row,col" into integers. Returns true on success.
inline bool parse_coord_key(const std::string& key, int& r, int& c) {
  std::istringstream ss(key);
  char comma;
  if (!(ss >> r >> comma >> c)) return false;
  return comma == ',';
}
