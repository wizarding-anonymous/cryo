# Integration Monitoring Guide

This document outlines the strategy for monitoring inter-service communication, primarily focusing on Kafka events.

## 1. Kafka Monitoring

The primary tool for monitoring Kafka is **Prometheus**, via the JMX Exporter.

### Prometheus JMX Exporter Configuration
A `kafka-jmx-config.yml` should be configured to scrape and format metrics from the Kafka brokers.

```yaml
# kafka-jmx-config.yml
rules:
  - pattern: kafka.server<type=(.+), name=(.+)><>Value
    name: kafka_server_$1_$2
  - pattern: kafka.server<type=(.+), name=(.+), topic=(.+)><>Value
    name: kafka_server_$1_$2
    labels:
      topic: "$3"
```

### Key Metrics to Monitor
-   `kafka_server_BrokerTopicMetrics_MessagesInPerSec`: Rate of incoming messages. A sudden drop could indicate a producer issue.
-   `kafka_server_BrokerTopicMetrics_BytesInPerSec`: Inbound traffic volume.
-   `kafka_consumer_lag_sum`: The most critical metric for ensuring consumers are keeping up. High or constantly growing lag indicates a problem with a consuming service.
-   `kafka_server_ReplicaManager_LeaderCount`: Monitors the health of broker leadership.

### Grafana Dashboard
A dedicated Grafana dashboard should be used to visualize these metrics.
-   **Recommended Base Dashboard**: [Kafka Exporter Overview (ID: 721)](https://grafana.com/grafana/dashboards/721-kafka-exporter-overview/)
-   **Custom Panels**: Add panels specifically for the topics used by the User Service (e.g., `user.registered`, `developer.profile.updated`).

### Alerting
Alerts should be configured in Alertmanager for critical conditions:
-   **High Consumer Lag**: `ALERT HighConsumerLag IF kafka_consumer_lag_sum > 1000 FOR 5m`
-   **No Leader**: `ALERT KafkaNoLeader FOR 1m`
-   **Low Message Rate**: `ALERT LowMessageRate IF rate(kafka_server_BrokerTopicMetrics_MessagesInPerSec[5m]) < 1 FOR 10m` (during expected traffic hours).

## 2. API Integration Health Checks

The `/health` endpoint should be expanded to include checks for critical downstream service integrations.

```typescript
// Example Health Check for Integrations
@Get('health/integrations')
@HealthCheck()
async checkIntegrations() {
  return this.health.check([
    // A check to see if the Kafka client is connected
    () => this.kafkaHealthIndicator.pingCheck('kafka'),

    // A conceptual check for event delivery. This could check the outbox
    // to see if there are old, unprocessed events.
    () => this.checkEventDelivery('DeveloperProfileUpdated'),
    () => this.checkEventDelivery('UserRegistered')
  ]);
}
```
