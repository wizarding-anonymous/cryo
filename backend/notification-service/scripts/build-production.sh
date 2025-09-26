#!/bin/bash

# Production Build Script for Notification Service
# This script builds optimized Docker images for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME=${IMAGE_NAME:-notification-service}
IMAGE_TAG=${IMAGE_TAG:-latest}
REGISTRY=${REGISTRY:-}
BUILD_ARGS=${BUILD_ARGS:-}

echo -e "${GREEN}🏗️  Starting production build for Notification Service${NC}"
echo -e "${YELLOW}Image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"

# Function to check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed or not in PATH${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is available${NC}"
}

# Function to check if Docker daemon is running
check_docker_daemon() {
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker daemon is running${NC}"
}

# Function to clean up old images
cleanup_old_images() {
    echo -e "${YELLOW}🧹 Cleaning up old images...${NC}"
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old versions of our image (keep last 3)
    OLD_IMAGES=$(docker images ${IMAGE_NAME} --format "table {{.Repository}}:{{.Tag}}" | tail -n +2 | tail -n +4)
    if [ ! -z "$OLD_IMAGES" ]; then
        echo "$OLD_IMAGES" | xargs -r docker rmi
        echo -e "${GREEN}✅ Cleaned up old images${NC}"
    else
        echo -e "${BLUE}ℹ️  No old images to clean up${NC}"
    fi
}

# Function to build the Docker image
build_image() {
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
    
    # Build the production image
    docker build \
        --target production \
        --tag ${IMAGE_NAME}:${IMAGE_TAG} \
        --tag ${IMAGE_NAME}:latest \
        ${BUILD_ARGS} \
        .
    
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
}

# Function to test the built image
test_image() {
    echo -e "${YELLOW}🧪 Testing the built image...${NC}"
    
    # Run a quick test container
    CONTAINER_ID=$(docker run -d \
        --name notification-service-test \
        -p 3001:3000 \
        -e NODE_ENV=production \
        -e DB_HOST=localhost \
        -e DB_PORT=5432 \
        -e DB_USERNAME=test \
        -e DB_PASSWORD=test \
        -e DB_DATABASE=test_db \
        -e REDIS_HOST=localhost \
        -e REDIS_PORT=6379 \
        ${IMAGE_NAME}:${IMAGE_TAG})
    
    # Wait for container to start
    sleep 10
    
    # Check if container is running
    if docker ps | grep -q notification-service-test; then
        echo -e "${GREEN}✅ Container started successfully${NC}"
        
        # Test health endpoint (this will fail without real DB, but container should start)
        if docker logs notification-service-test 2>&1 | grep -q "Notification Service запущен"; then
            echo -e "${GREEN}✅ Application started successfully${NC}"
        else
            echo -e "${YELLOW}⚠️  Application may have issues (check logs)${NC}"
            docker logs notification-service-test
        fi
    else
        echo -e "${RED}❌ Container failed to start${NC}"
        docker logs notification-service-test
        exit 1
    fi
    
    # Clean up test container
    docker stop notification-service-test > /dev/null 2>&1 || true
    docker rm notification-service-test > /dev/null 2>&1 || true
}

# Function to push to registry
push_to_registry() {
    if [ ! -z "$REGISTRY" ]; then
        echo -e "${YELLOW}📤 Pushing to registry: ${REGISTRY}${NC}"
        
        # Tag for registry
        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:latest
        
        # Push to registry
        docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}
        docker push ${REGISTRY}/${IMAGE_NAME}:latest
        
        echo -e "${GREEN}✅ Images pushed to registry${NC}"
    else
        echo -e "${BLUE}ℹ️  No registry specified, skipping push${NC}"
    fi
}

# Function to show image information
show_image_info() {
    echo -e "${GREEN}📊 Image Information:${NC}"
    docker images ${IMAGE_NAME}:${IMAGE_TAG}
    
    echo -e "${YELLOW}🏷️  Image Tags:${NC}"
    docker images ${IMAGE_NAME} --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo -e "${YELLOW}📝 Usage Examples:${NC}"
    echo "  Run container: docker run -p 3000:3000 ${IMAGE_NAME}:${IMAGE_TAG}"
    echo "  Run with compose: docker-compose -f docker-compose.prod.yml up"
    echo "  Deploy to K8s: kubectl set image deployment/notification-service-deployment notification-service=${IMAGE_NAME}:${IMAGE_TAG}"
}

# Main execution
main() {
    echo -e "${GREEN}🔍 Pre-build checks...${NC}"
    check_docker
    check_docker_daemon
    
    echo -e "${GREEN}🚀 Starting build process...${NC}"
    cleanup_old_images
    build_image
    test_image
    push_to_registry
    show_image_info
    
    echo -e "${GREEN}✨ Production build completed successfully!${NC}"
    echo -e "${BLUE}Image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
}

# Run main function
main "$@"