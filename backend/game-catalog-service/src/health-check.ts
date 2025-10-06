#!/usr/bin/env node

/**
 * Standalone health check script for Docker HEALTHCHECK
 * This script performs a simple HTTP request to the health endpoint
 */

import * as http from 'http';

const HEALTH_CHECK_URL = 'http://localhost:3002/api/v1/health/live';
const TIMEOUT = 3000; // 3 seconds timeout

function performHealthCheck(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = http.get(
      HEALTH_CHECK_URL,
      { timeout: TIMEOUT },
      (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            console.log('Health check passed');
            resolve();
          } else {
            console.error(
              `Health check failed with status: ${response.statusCode}`,
            );
            console.error('Response:', data);
            reject(
              new Error(
                `Health check failed with status: ${response.statusCode}`,
              ),
            );
          }
        });
      },
    );

    request.on('error', (error) => {
      console.error('Health check request failed:', error.message);
      reject(error);
    });

    request.on('timeout', () => {
      console.error('Health check request timed out');
      request.destroy();
      reject(new Error('Health check request timed out'));
    });
  });
}

// Execute health check
performHealthCheck()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Health check failed:', error.message);
    process.exit(1);
  });
