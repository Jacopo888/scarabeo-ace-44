cmake_minimum_required(VERSION 3.16)
project(engine_wrapper CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
add_compile_options(-fPIC)

# === Parametri passati dal Dockerfile / ambiente ===
# Esempi:
#   -DQUACKLE_ROOT=/src/third_party/quackle
#   -DQUACKLE_BUILD_DIR=/src/third_party/quackle/build
if(NOT DEFINED QUACKLE_ROOT)
  message(FATAL_ERROR "QUACKLE_ROOT non definito (root del submodule quackle)")
endif()
if(NOT DEFINED QUACKLE_BUILD_DIR)
  message(FATAL_ERROR "QUACKLE_BUILD_DIR non definito (build dir del submodule quackle)")
endif()

# Fail-fast: controlli esistenza percorsi e artefatti
if(NOT EXISTS "${QUACKLE_ROOT}")
  message(FATAL_ERROR "QUACKLE_ROOT non esiste: ${QUACKLE_ROOT}")
endif()
if(EXISTS "${QUACKLE_ROOT}/src")
  message(WARNING "Rilevata cartella ${QUACKLE_ROOT}/src, ma NON deve essere usata per include.")
endif()
if(NOT EXISTS "${QUACKLE_BUILD_DIR}/liblibquackle.a")
  message(FATAL_ERROR "Static lib mancante: ${QUACKLE_BUILD_DIR}/liblibquackle.a. Compila prima la lib nel submodule.")
endif()

# nlohmann/json (header-only)
include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

# Importa la static lib costruita nel submodule
add_library(quackle_external STATIC IMPORTED GLOBAL)
set_target_properties(quackle_external PROPERTIES
  IMPORTED_LOCATION "${QUACKLE_BUILD_DIR}/liblibquackle.a"
  INTERFACE_INCLUDE_DIRECTORIES "${QUACKLE_ROOT}"  # << include dalla root del submodule
)

add_executable(engine_wrapper engine.cpp)
target_link_libraries(engine_wrapper PRIVATE quackle_external nlohmann_json::nlohmann_json)


