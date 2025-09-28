// Shared utilities for quackle_bridge.cpp
// Phase 2: extracted without behavior changes
#pragma once

#include <string>
#include <fstream>
#include <iostream>
#include <filesystem>
#include <vector>
#include <iomanip>
#include <sstream>
#include <utility>
#include <system_error>
#include <cstdio>

namespace fs = std::filesystem;

// --- Arg/env helpers ---
inline std::string arg(int argc, char** argv, const std::string& k, const std::string& d) {
  for (int i=1;i<argc-1;++i) if (std::string(argv[i])==k) return std::string(argv[i+1]);
  return d;
}
inline bool hasFlag(int argc, char** argv, const std::string& k) {
  for (int i=1;i<argc;++i) if (std::string(argv[i])==k) return true;
  return false;
}
inline bool env_flag_on(const char* name) {
  const char* v = std::getenv(name);
  if (!v) return false;
  std::string s(v);
  for (auto &c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return (s == "1" || s == "true" || s == "yes" || s == "on");
}

// --- Debug logging ---
inline void debugLog(const std::string& message) {
  std::ofstream debugFile("/tmp/quackle_debug.log", std::ios::app);
  if (debugFile.is_open()) {
    debugFile << "[DEBUG] " << message << std::endl;
    debugFile.close();
  }
  std::cerr << "[DEBUG] " << message << std::endl;
}
inline void cursorDebugLog(const std::string& message) {
  std::cerr << "[CURSOR_C++] " << message << std::endl;
  std::ofstream debugFile("/tmp/quackle_bridge_debug.log", std::ios::app);
  if (debugFile.is_open()) {
    debugFile << "[CURSOR_C++] " << message << std::endl;
  }
}

// --- Strategy presence checks (filesystem) ---
inline bool file_ok(const fs::path& p, size_t* out_size = nullptr) {
  std::error_code ec;
  if (fs::exists(p, ec) && fs::is_regular_file(p, ec)) {
    auto sz = fs::file_size(p, ec);
    if (!ec && sz > 0) { if (out_size) *out_size = static_cast<size_t>(sz); return true; }
  }
  return false;
}
inline void log_hex_head(const fs::path& path) {
  std::ifstream f(path, std::ios::binary);
  if (!f.good()) return;
  unsigned char buf[16]{};
  f.read(reinterpret_cast<char*>(buf), 16);
  std::ostringstream oss;
  for (int i = 0; i < 16; ++i) {
    oss << std::hex << std::setw(2) << std::setfill('0') << (int)buf[i];
  }
  std::fprintf(stderr, "[DEBUG] Strategy head16 %s: %s\n", path.string().c_str(), oss.str().c_str());
}

struct StrategyPaths { fs::path syn2, vcplace, superleaves, worths, bogowin; };

inline StrategyPaths compute_strategy_paths(const fs::path& appdata_base) {
  fs::path base = appdata_base / "strategy";
  StrategyPaths s{
      base / "default_english" / "syn2",
      base / "default_english" / "vcplace",
      base / "default_english" / "superleaves",
      base / "default_english" / "worths",
      base / "default" / "bogowin",
  };
  std::fprintf(stderr, "[DEBUG] Strategy expected paths:\n  syn2=%s\n  vcplace=%s\n  superleaves=%s\n  worths=%s\n  bogowin=%s\n",
          s.syn2.string().c_str(), s.vcplace.string().c_str(), s.superleaves.string().c_str(), s.worths.string().c_str(), s.bogowin.string().c_str());
  return s;
}

inline void require_strategy_files_or_die(const StrategyPaths& s) {
  const std::vector<std::pair<const char*, fs::path>> req = {
      {"syn2", s.syn2}, {"vcplace", s.vcplace}, {"superleaves", s.superleaves}, {"worths", s.worths}, {"bogowin", s.bogowin},
  };
  for (const auto& kv : req) {
    size_t sz = 0;
    if (!file_ok(kv.second, &sz)) {
      std::fprintf(stderr, "[CONFIG] Strategy candidate missing: %s\n", kv.second.string().c_str());
      std::exit(72);
    }
    std::fprintf(stderr, "[DEBUG] Strategy %s -> %s (size=%zu)\n", kv.first, kv.second.string().c_str(), sz);
    log_hex_head(kv.second);
  }
}
