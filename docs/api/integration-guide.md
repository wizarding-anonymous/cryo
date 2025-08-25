# User Service API Integration Guide

This document provides instructions and examples for integrating with the User Service API.

## Authentication

All requests must include a valid JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer {your_jwt_token}
```

---

## Developer Portal Service Integration

The User Service is the source of truth for basic developer profile data. The Developer Portal Service should query these endpoints to retrieve this information.

### Getting Basic Developer Profile

To get the basic profile information for a specific developer, use the following endpoint.

* **Endpoint:** `GET /api/v1/developers/{userId}/basic-profile`
* **Method:** `GET`
* **Description:** Retrieves core information about a developer, such as company name, contact details, and verification status.

**Example Request:**
```http
GET /api/v1/developers/c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e/basic-profile
Authorization: Bearer {jwt_token}
```

**Example Response (200 OK):**
```json
{
  "id": "a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1",
  "userId": "c6f7e3d8-9a0a-4b3e-8c3f-3e3e3e3e3e3e",
  "companyName": "Example Studio",
  "companyType": "llc",
  "contactEmail": "contact@example.com",
  "isVerified": true,
  "verificationStatus": "approved"
}
```

**Error Handling:**
* **404 Not Found:** Returned if a developer profile for the given `userId` does not exist.
* **401 Unauthorized:** Returned if the JWT token is missing or invalid.

---

### Getting Developer Verification Status

* **Endpoint:** `GET /api/v1/developers/{userId}/verification-status`
* **Method:** `GET`
* **Description:** Retrieves just the verification status portion of the developer profile.

**Example Response (200 OK):**
```json
{
  "status": "approved",
  "isVerified": true
}
```
