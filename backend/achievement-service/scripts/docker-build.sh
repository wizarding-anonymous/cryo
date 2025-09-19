#!/bin/bash

# Docker Build Script for Achievement Service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="achievement-service"
TAG="latest"
ENVIRONMENT="production"
PUSH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -p|--push)
      PUSH=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  -t, --tag TAG        Docker image tag (default: latest)"
      echo "  -e, --env ENV        Environment (default: production)"
      echo "  -p, --push           Push image to registry"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}Building Achievement Service Docker image...${NC}"
echo -e "${YELLOW}Image: ${IMAGE_NAME}:${TAG}${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"

# Build the Docker image
echo -e "${GREEN}Step 1: Building Docker image${NC}"
docker build \
  --build-arg NODE_ENV=${ENVIRONMENT} \
  -t ${IMAGE_NAME}:${TAG} \
  -f Dockerfile \
  .

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
  echo -e "${RED}✗ Docker build failed${NC}"
  exit 1
fi

# Tag with environment
if [ "${TAG}" != "${ENVIRONMENT}" ]; then
  echo -e "${GREEN}Step 2: Tagging image for environment${NC}"
  docker tag ${IMAGE_NAME}:${TAG} ${IMAGE_NAME}:${ENVIRONMENT}
fi

# Show image info
echo -e "${GREEN}Step 3: Image information${NC}"
docker images ${IMAGE_NAME}

# Push to registry if requested
if [ "${PUSH}" = true ]; then
  echo -e "${GREEN}Step 4: Pushing to registry${NC}"
  docker push ${IMAGE_NAME}:${TAG}
  if [ "${TAG}" != "${ENVIRONMENT}" ]; then
    docker push ${IMAGE_NAME}:${ENVIRONMENT}
  fi
  echo -e "${GREEN}✓ Image pushed to registry${NC}"
fi

echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${YELLOW}To run the container:${NC}"
echo "docker run -p 3003:3003 --env-file .env.${ENVIRONMENT} ${IMAGE_NAME}:${TAG}"