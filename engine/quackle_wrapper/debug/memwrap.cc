#include "memwrap.h"
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <execinfo.h>
#include <unistd.h>

// Global watch range
static void* g_watch_base = nullptr;
static size_t g_watch_size = 0;
static const size_t GUARD_SIZE = 128; // Guard window around the watched range

void memwrap_set_watch_range(void* base, size_t size) {
    g_watch_base = base;
    g_watch_size = size;
    fprintf(stderr, "[MEMWRAP] Watch range set: base=%p size=%zu\n", base, size);
}

bool memwrap_check_overlap(const void* ptr, size_t size) {
    if (!g_watch_base || !ptr) return false;
    
    // Calculate the effective write range
    const char* write_start = static_cast<const char*>(ptr);
    const char* write_end = write_start + size;
    
    // Calculate the guarded watch range
    const char* watch_start = static_cast<const char*>(g_watch_base) - GUARD_SIZE;
    const char* watch_end = static_cast<const char*>(g_watch_base) + g_watch_size + GUARD_SIZE;
    
    // Check for overlap
    return (write_start < watch_end && write_end > watch_start);
}

void memwrap_log_hit(const char* func, const void* dst, const void* src, size_t n) {
    fprintf(stderr, "[MEMWRAP][HIT] func=%s dst=%p src=%p n=%zu (overlap with Rack @ [%p..%p))\n",
            func, dst, src, n, g_watch_base, 
            static_cast<const char*>(g_watch_base) + g_watch_size);
    
    // Print backtrace
    void* buffer[10];
    int size = backtrace(buffer, 10);
    char** strings = backtrace_symbols(buffer, size);
    if (strings) {
        fprintf(stderr, "[MEMWRAP] Backtrace:\n");
        for (int i = 0; i < size; i++) {
            fprintf(stderr, "[MEMWRAP]   %s\n", strings[i]);
        }
        free(strings);
    }
}

// Wrapped memory functions
extern "C" {

// Declare the real functions
void* __real_memcpy(void* dst, const void* src, size_t n);
void* __real_memmove(void* dst, const void* src, size_t n);
void* __real_memset(void* dst, int c, size_t n);
char* __real_strcpy(char* dst, const char* src);
char* __real_strncpy(char* dst, const char* src, size_t n);
char* __real_strcat(char* dst, const char* src);
char* __real_strncat(char* dst, const char* src, size_t n);
void __real_bcopy(const void* src, void* dst, size_t n);

void* __wrap_memcpy(void* dst, const void* src, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("memcpy", dst, src, n);
    }
    return __real_memcpy(dst, src, n);
}

void* __wrap_memmove(void* dst, const void* src, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("memmove", dst, src, n);
    }
    return __real_memmove(dst, src, n);
}

void* __wrap_memset(void* dst, int c, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("memset", dst, nullptr, n);
    }
    return __real_memset(dst, c, n);
}

char* __wrap_strcpy(char* dst, const char* src) {
    if (src && memwrap_check_overlap(dst, strlen(src) + 1)) {
        memwrap_log_hit("strcpy", dst, src, strlen(src) + 1);
    }
    return __real_strcpy(dst, src);
}

char* __wrap_strncpy(char* dst, const char* src, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("strncpy", dst, src, n);
    }
    return __real_strncpy(dst, src, n);
}

char* __wrap_strcat(char* dst, const char* src) {
    if (src) {
        size_t dst_len = strlen(dst);
        size_t src_len = strlen(src);
        if (memwrap_check_overlap(dst + dst_len, src_len + 1)) {
            memwrap_log_hit("strcat", dst, src, src_len + 1);
        }
    }
    return __real_strcat(dst, src);
}

char* __wrap_strncat(char* dst, const char* src, size_t n) {
    if (src) {
        size_t dst_len = strlen(dst);
        if (memwrap_check_overlap(dst + dst_len, n + 1)) {
            memwrap_log_hit("strncat", dst, src, n + 1);
        }
    }
    return __real_strncat(dst, src, n);
}

void __wrap_bcopy(const void* src, void* dst, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("bcopy", dst, src, n);
    }
    __real_bcopy(src, dst, n);
}

} // extern "C"
