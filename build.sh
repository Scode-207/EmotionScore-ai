#!/bin/bash

# Build script for Vercel deployment
echo "Building EmotionScore for production..."

# Install dependencies
npm install

# Build the client
npm run build

# Ensure server files are ready
echo "Build complete!"