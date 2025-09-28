// Helpers to emit standardized JSON responses for error/pass envelopes
#pragma once

#include "nlohmann/json.hpp"
#include <iostream>

using json = nlohmann::json;

// Print a standardized pass envelope with engine_fallback=true and an error code.
// Does not append a newline, mirroring most existing call sites.
inline void print_pass_error(const std::string& error_code) {
  json out;
  out["tiles"] = json::array();
  out["score"] = 0;
  out["words"] = json::array();
  out["move_type"] = "pass";
  out["engine_fallback"] = true;
  out["error"] = error_code;
  std::cout << out.dump();
}

// Same as print_pass_error but returns the provided rc for use with `return` chaining.
inline int emit_pass_error_rc(const std::string& error_code, int rc) {
  print_pass_error(error_code);
  return rc;
}

// Variant that allows adding extra fields to the standard envelope (e.g., reason/out_of_bounds).
inline void print_pass_error(const std::string& error_code, const json& extra) {
  json out;
  out["tiles"] = json::array();
  out["score"] = 0;
  out["words"] = json::array();
  out["move_type"] = "pass";
  out["engine_fallback"] = true;
  out["error"] = error_code;
  for (auto it = extra.begin(); it != extra.end(); ++it) {
    out[it.key()] = it.value();
  }
  std::cout << out.dump();
}

// Same as emit_pass_error_rc but with extra fields in the envelope.
inline int emit_pass_error_rc(const std::string& error_code, const json& extra, int rc) {
  print_pass_error(error_code, extra);
  return rc;
}
