#!/bin/bash

# Docker Build Script for Achievement Service
# Usage: ./scripts/docker-build.sh [environment] [tag]

set -e

# Default values
ENVIRONMENT=${1:-production}
TAG=${2:-latest}
IMAGE_NAME="achievement-service"
REGISTRY=${DOCKER_REGISTRY:-""}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐳 Building Achievement Service Docker Image${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"
echo -e "${YELLOW}Tag: ${TAG}${NC}"

# Validate environment
case $ENVIRONMENT in
  development|dev)
    DOCKERFILE="Dockerfile"
    TARGET="builder"
    ;;
  staging|stage)
    DOCKERFILE="Dockerfile"
    TARGET="runner"
    ;;
  production|prod)
    DOCKERFILE="Dockerfile"
    TARGET="runner"
    ;;
  *)
    echo -e "${RED}❌ Invalid environment: ${ENVIRONMENT}${NC}"
    echo "Valid environments: development, staging, production"
    exit 1
    ;;
esac

# Build image
echo -e "${GREEN}📦 Building Docker image...${NC}"
docker build \
  --file ${DOCKERFILE} \
  --target ${TARGET} \
  --tag ${IMAGE_NAME}:${TAG} \
  --tag ${IMAGE_NAME}:${ENVIRONMENT}-${TAG} \
  --build-arg NODE_ENV=${ENVIRONMENT} \
  .

# Tag for registry if specified
if [ ! -z "$REGISTRY" ]; then
  echo -e "${GREEN}🏷️  Tagging for registry: ${REGISTRY}${NC}"
  docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${TAG}
  docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${ENVIRONMENT}-${TAG}
fi

# Show image info
echo -e "${GREEN}✅ Build completed successfully!${NC}"
echo -e "${YELLOW}Image size:${NC}"
docker images ${IMAGE_NAME}:${TAG} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Security scan (if trivy is available)
if command -v trivy &> /dev/null; then
  echo -e "${GREEN}🔍 Running security scan...${NC}"
  trivy image --severity HIGH,CRITICAL ${IMAGE_NAME}:${TAG}
fi

echo -e "${GREEN}🚀 Ready to deploy!${NC}"
echo -e "${YELLOW}To run: docker run -p 3003:3003 ${IMAGE_NAME}:${TAG}${NC}"

if [ ! -z "$REGISTRY" ]; then
  echo -e "${YELLOW}To push: docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}${NC}"
fi