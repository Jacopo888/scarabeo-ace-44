#ifndef MEMWRAP_H
#define MEMWRAP_H

#include <cstddef>

// API to set the watch range for memory operations
void memwrap_set_watch_range(void* base, size_t size);

// Check if a memory range overlaps with the watched range
bool memwrap_check_overlap(const void* ptr, size_t size);

// Log a memory operation that overlaps with the watched range
void memwrap_log_hit(const char* func, const void* dst, const void* src, size_t n);

#endif // MEMWRAP_H
