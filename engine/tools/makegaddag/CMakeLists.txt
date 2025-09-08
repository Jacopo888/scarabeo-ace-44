cmake_minimum_required(VERSION 3.16)
project(makegaddag CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)
add_compile_options(-fPIC -O2)

if(NOT DEFINED QUACKLE_ROOT)
  message(FATAL_ERROR "QUACKLE_ROOT non definito (path root submodule quackle)")
endif()
if(NOT DEFINED QUACKLE_BUILD_DIR)
  message(FATAL_ERROR "QUACKLE_BUILD_DIR non definito (build dir submodule quackle)")
endif()

if(NOT EXISTS "${QUACKLE_BUILD_DIR}/liblibquackle.a")
  message(FATAL_ERROR "Static lib mancante: ${QUACKLE_BUILD_DIR}/liblibquackle.a")
endif()

find_package(Threads REQUIRED)
find_package(Qt5 COMPONENTS Core REQUIRED)

add_executable(makegaddag
  main.cpp
  ${QUACKLE_ROOT}/quackleio/gaddagfactory.cpp
  ${QUACKLE_ROOT}/quackleio/util.cpp
  ${QUACKLE_ROOT}/quackleio/flexiblealphabet.cpp
)

target_include_directories(makegaddag PRIVATE
  ${QUACKLE_ROOT}
  ${QUACKLE_ROOT}/quackleio
)

add_library(quackle_external STATIC IMPORTED GLOBAL)
set_target_properties(quackle_external PROPERTIES
  IMPORTED_LOCATION "${QUACKLE_BUILD_DIR}/liblibquackle.a"
  INTERFACE_INCLUDE_DIRECTORIES "${QUACKLE_ROOT}"
)

target_compile_definitions(makegaddag PRIVATE QUACKLE_NO_QT)
target_link_libraries(makegaddag PRIVATE quackle_external Qt5::Core Threads::Threads)


