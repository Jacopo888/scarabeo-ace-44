#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <execinfo.h>
#include <unistd.h>

// Global watch range
static void* g_watch_base = nullptr;
static size_t g_watch_size = 0;
static const size_t GUARD_SIZE = 128;

extern "C" {

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

// Wrapper functions that will be called from our code
void* memwrap_memcpy(void* dst, const void* src, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("memcpy", dst, src, n);
    }
    return memcpy(dst, src, n);
}

void* memwrap_memset(void* dst, int c, size_t n) {
    if (memwrap_check_overlap(dst, n)) {
        memwrap_log_hit("memset", dst, nullptr, n);
    }
    return memset(dst, c, n);
}

} // extern "C"
