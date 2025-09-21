#include <iostream>
#include <cstring>

// Mock the Quackle constants and types for testing
#define QUACKLE_FIRST_LETTER 1
#define QUACKLE_MAXIMUM_ALPHABET_SIZE 30

typedef char Letter;
typedef std::string LetterString;
typedef std::string FixedLengthString;

// Mock the String class with our fixed counts function
class String {
public:
    static void counts(const LetterString &letterString, char *countsArray) {
        for (int j = 0; j < QUACKLE_FIRST_LETTER + QUACKLE_MAXIMUM_ALPHABET_SIZE; ++j)
            countsArray[j] = 0;

        const LetterString::const_iterator end(letterString.end());
        for (LetterString::const_iterator it = letterString.begin(); it != end; ++it) {
            int idx = static_cast<int>(static_cast<unsigned char>(*it));
            if (idx >= QUACKLE_FIRST_LETTER &&
                idx < (QUACKLE_FIRST_LETTER + QUACKLE_MAXIMUM_ALPHABET_SIZE)) {
                countsArray[idx]++;
            }
            // Ignora valori fuori range per evitare OOB
        }
    }
};

int main() {
    std::cout << "Testing robust counts function..." << std::endl;
    
    // Test with normal letters (using Quackle internal representation)
    LetterString test1;
    test1 += (char)(QUACKLE_FIRST_LETTER + 0);  // A
    test1 += (char)(QUACKLE_FIRST_LETTER + 4);  // E  
    test1 += (char)(QUACKLE_FIRST_LETTER + 8);  // I
    test1 += (char)(QUACKLE_FIRST_LETTER + 17); // R
    test1 += (char)(QUACKLE_FIRST_LETTER + 18); // S
    test1 += (char)(QUACKLE_FIRST_LETTER + 19); // T
    test1 += (char)(QUACKLE_FIRST_LETTER + 25); // Z
    char counts1[QUACKLE_FIRST_LETTER + QUACKLE_MAXIMUM_ALPHABET_SIZE];
    String::counts(test1, counts1);
    
    std::cout << "Test 1 - Normal letters: ";
    for (int i = QUACKLE_FIRST_LETTER; i < QUACKLE_FIRST_LETTER + 26; ++i) {
        if (counts1[i] > 0) {
            std::cout << (char)('A' + i - QUACKLE_FIRST_LETTER) << ":" << (int)counts1[i] << " ";
        }
    }
    std::cout << std::endl;
    
    // Test with out-of-bounds values (should be safely ignored)
    LetterString test2 = "A\xFF\x00Z"; // Contains invalid characters
    char counts2[QUACKLE_FIRST_LETTER + QUACKLE_MAXIMUM_ALPHABET_SIZE];
    String::counts(test2, counts2);
    
    std::cout << "Test 2 - With invalid chars: ";
    for (int i = QUACKLE_FIRST_LETTER; i < QUACKLE_FIRST_LETTER + 26; ++i) {
        if (counts2[i] > 0) {
            std::cout << (char)('A' + i - QUACKLE_FIRST_LETTER) << ":" << (int)counts2[i] << " ";
        }
    }
    std::cout << std::endl;
    
    // Test with empty string
    LetterString test3 = "";
    char counts3[QUACKLE_FIRST_LETTER + QUACKLE_MAXIMUM_ALPHABET_SIZE];
    String::counts(test3, counts3);
    
    std::cout << "Test 3 - Empty string: ";
    bool hasAny = false;
    for (int i = QUACKLE_FIRST_LETTER; i < QUACKLE_FIRST_LETTER + 26; ++i) {
        if (counts3[i] > 0) {
            std::cout << (char)('A' + i - QUACKLE_FIRST_LETTER) << ":" << (int)counts3[i] << " ";
            hasAny = true;
        }
    }
    if (!hasAny) std::cout << "(empty)";
    std::cout << std::endl;
    
    std::cout << "All tests completed successfully - no crashes!" << std::endl;
    return 0;
}
