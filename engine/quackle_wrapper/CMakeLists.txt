cmake_minimum_required(VERSION 3.16)
project(engine_wrapper CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
add_compile_options(-fPIC)

# nlohmann/json header-only
include(FetchContent)
FetchContent_Declare(
  nlohmann_json
  GIT_REPOSITORY https://github.com/nlohmann/json.git
  GIT_TAG v3.11.3
)
FetchContent_MakeAvailable(nlohmann_json)

#
# Quackle static library (built separately in Dockerfile)
# Expect variables:
#  - QUACKLE_ROOT: path to quackle source root
#  - QUACKLE_BUILD_DIR: path to quackle build dir (containing libquackle.a)
#
set(QUACKLE_ROOT "${PROJECT_SOURCE_DIR}/../third_party/quackle" CACHE PATH "Quackle source root")
set(QUACKLE_BUILD_DIR "${PROJECT_SOURCE_DIR}/../third_party/quackle/build" CACHE PATH "Quackle build directory")

find_library(LIBQUACKLE NAMES quackle libquackle liblibquackle
  PATHS
    ${QUACKLE_BUILD_DIR}
    ${QUACKLE_BUILD_DIR}/lib
    ${QUACKLE_BUILD_DIR}/src
    ${QUACKLE_BUILD_DIR}/src/libquackle
  NO_DEFAULT_PATH)

if(NOT LIBQUACKLE)
  message(FATAL_ERROR "libquackle not found. Set QUACKLE_BUILD_DIR to the directory containing libquackle.a")
endif()

add_library(quackle_core STATIC IMPORTED)
set_target_properties(quackle_core PROPERTIES IMPORTED_LOCATION "${LIBQUACKLE}")
target_include_directories(quackle_core INTERFACE
  ${QUACKLE_ROOT}
  ${QUACKLE_ROOT}/src
  ${QUACKLE_ROOT}/src/libquackle
  ${QUACKLE_ROOT}/src/libquackle/include
)
target_compile_definitions(quackle_core INTERFACE QUACKLE_NO_QT)

add_executable(engine_wrapper engine.cpp)

target_link_libraries(engine_wrapper PRIVATE
  quackle_core
  nlohmann_json::nlohmann_json
  icuuc
  icui18n
  pthread
  boost_system
  boost_filesystem
  boost_regex)


