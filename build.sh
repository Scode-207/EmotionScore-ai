#!/bin/bash
set -e

echo "Starting Railway build process..."

# Build the frontend from the client directory
echo "Building frontend..."
cd client
npm run build
cd ..

# build in the backend
echo "Building backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Build completed successfully!"
