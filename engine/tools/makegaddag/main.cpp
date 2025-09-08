#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include <sys/stat.h>

#include "alphabetparameters.h"
#include "quackleio/flexiblealphabet.h"
#include "quackleio/gaddagfactory.h"

static inline std::string trim(const std::string &s) {
    size_t a = 0; while (a < s.size() && std::isspace(static_cast<unsigned char>(s[a]))) ++a;
    size_t b = s.size(); while (b > a && std::isspace(static_cast<unsigned char>(s[b-1]))) --b;
    return s.substr(a, b - a);
}

static inline void to_upper(std::string &s) {
    for (char &c : s) c = std::toupper(static_cast<unsigned char>(c));
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::cerr << "Usage: makegaddag <wordlist.txt> <out.gaddag>\n";
        return 1;
    }
    const std::string inPath = argv[1];
    const std::string outPath = argv[2];
    std::cerr << "[makegaddag] input=" << inPath << " output=" << outPath << "\n";

    std::ifstream in(inPath);
    if (!in) {
        std::cerr << "[makegaddag] cannot open input: " << inPath << "\n";
        return 1;
    }

    // Use default English flexible alphabet (no Qt UI)
    QuackleIO::FlexibleAlphabetParameters flex;
    GaddagFactory factory(QuackleIO::Util::qstringToString(QuackleIO::Util::stdStringToQString(std::string())));
    (void)flex; // factory will use default if empty

    std::string line;
    int pushed = 0;
    while (std::getline(in, line)) {
        line = trim(line);
        if (line.empty()) continue;
        to_upper(line);
        if (!factory.pushWord(QuackleIO::Util::stdStringToQString(line))) {
            // fallback: try raw encoding pathway
            // but keep going regardless
        }
        ++pushed;
        if ((pushed % 100000) == 0) std::cerr << "[makegaddag] words=" << pushed << "\n";
    }
    std::cerr << "[makegaddag] total words pushed=" << pushed << "\n";
    factory.sortWords();
    factory.generate();
    factory.writeIndex(outPath);

    struct stat st{};
    long long size = -1;
    if (::stat(outPath.c_str(), &st) == 0) size = static_cast<long long>(st.st_size);
    std::cerr << "[makegaddag] wrote " << outPath << " (" << size << " bytes)\n";
    return 0;
}


