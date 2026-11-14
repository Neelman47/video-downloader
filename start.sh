#!/usr/bin/env bash
# StreamVault - Production Launcher for macOS & Linux
echo "==================================================="
echo "  Starting StreamVault - YouTube Downloader"
echo "==================================================="
echo ""

# Ensure dependencies are installed
if [ ! -d "server/node_modules" ]; then
  echo "Installing server dependencies..."
  npm install --prefix server
fi

node server/index.js
