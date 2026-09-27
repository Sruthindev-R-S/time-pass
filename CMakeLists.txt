cmake_minimum_required(VERSION 3.16)

project(portaudio_listener LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(PkgConfig REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)
pkg_check_modules(PORTAUDIO REQUIRED IMPORTED_TARGET portaudio-2.0)

add_executable(portaudio_listener
    engine/main.cpp
    engine/websocket_server.cpp
)
target_link_libraries(portaudio_listener PRIVATE
	PkgConfig::PORTAUDIO
	OpenSSL::Crypto
	Threads::Threads
)
