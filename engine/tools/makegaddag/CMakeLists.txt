cmake_minimum_required(VERSION 3.16)
project(makegaddag LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Parametri passati dal Dockerfile
if(NOT DEFINED QUACKLE_ROOT)
  message(FATAL_ERROR "QUACKLE_ROOT not set")
endif()
if(NOT DEFINED QUACKLE_BUILD_DIR)
  message(FATAL_ERROR "QUACKLE_BUILD_DIR not set")
endif()

find_package(Threads REQUIRED)

add_executable(makegaddag
  main.cpp
)

target_compile_definitions(makegaddag PRIVATE QUACKLE_NO_QT)
target_include_directories(makegaddag PRIVATE
  ${QUACKLE_ROOT}            # include del core quackle (header .h/.hpp nel root)
  ${QUACKLE_ROOT}/bindings   # se servono header interni presenti in bindings
)
# Linka la static lib del core
target_link_libraries(makegaddag PRIVATE
  ${QUACKLE_BUILD_DIR}/liblibquackle.a
  Threads::Threads
)

# ottimizzazioni base
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()


