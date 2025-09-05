#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <QtCore>
#include "quackleio/dawgfactory.h"
#include "quackleio/util.h"

int main(int argc, char** argv){
  if(argc<3){
    std::cerr << "usage: build_dawg <wordlist.txt> <out.dawg> [alphabet=english]\n"; return 1;
  }
  QString alphabet = argc>=4 ? argv[3] : QString("english");
  QString alphabetFile = QString("../data/alphabets/%1.quackle_alphabet").arg(alphabet);
  DawgFactory factory(alphabetFile);

  std::ifstream in(argv[1]);
  if(!in.good()){ std::cerr << "cannot open wordlist: " << argv[1] << "\n"; return 2; }
  std::string w; int count=0; while(in>>w){
    Quackle::LetterString ls;
    for(char c: w){ ls.push_back(std::toupper(static_cast<unsigned char>(c))); }
    factory.pushWord(ls, false, 0);
    ++count;
  }
  std::cerr << "Loaded words: " << count << "\n";
  factory.generate();
  factory.writeIndex(argv[2]);
  std::cerr << "Wrote DAWG: " << argv[2] << " nodes=" << factory.nodeCount() << " encodable=" << factory.encodableWords() << "\n";
  return 0;
}
