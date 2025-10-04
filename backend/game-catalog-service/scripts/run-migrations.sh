#!/bin/bash

# Manual migration script for Game Catalog Service
# This script should be run manually before starting the service
# Usage: ./scripts/run-migrations.sh [show|run|revert]

set -e

COMMAND=${1:-show}

echo "🚀 Game Catalog Service - Manual Migration Tool"
echo "================================================"

case $COMMAND in
    show)
        echo "📋 Showing current migration status..."
        npm run migration:show
        ;;
    run)
        echo "🔄 Running pending migrations..."
        
        # Show current status first
        echo "📋 Current migration status:"
        npm run migration:show || echo "⚠️  Could not show migration status (this is normal for first run)"
        
        # Ask for confirmation
        echo
        read -p "🔄 Run pending migrations? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Migration cancelled"
            exit 1
        fi
        
        # Run migrations
        echo "🔄 Running migrations..."
        npm run migration:run
        
        echo "✅ Migrations completed successfully!"
        
        # Show final status
        echo "📋 Final migration status:"
        npm run migration:show
        ;;
    revert)
        echo "⚠️  Reverting last migration..."
        
        # Show current status first
        echo "📋 Current migration status:"
        npm run migration:show
        
        # Ask for confirmation
        echo
        read -p "⚠️  Are you sure you want to revert the last migration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Revert cancelled"
            exit 1
        fi
        
        # Revert migration
        echo "🔄 Reverting last migration..."
        npm run migration:revert
        
        echo "✅ Migration reverted successfully!"
        
        # Show final status
        echo "📋 Final migration status:"
        npm run migration:show
        ;;
    *)
        echo "Usage: $0 [show|run|revert]"
        echo ""
        echo "Commands:"
        echo "  show   - Show current migration status (default)"
        echo "  run    - Run pending migrations"
        echo "  revert - Revert last migration"
        echo ""
        echo "Examples:"
        echo "  $0 show    # Show migration status"
        echo "  $0 run     # Run pending migrations"
        echo "  $0 revert  # Revert last migration"
        echo ""
        echo "Note: Migrations must be run manually before starting the service."
        exit 1
        ;;
esac