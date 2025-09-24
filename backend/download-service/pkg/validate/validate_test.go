package validate

import (
    "testing"

    "github.com/stretchr/testify/assert"
)

type TestStruct struct {
    ID       string `validate:"required,uuid4"`
    Name     string `validate:"required,min=1,max=100"`
    Age      int    `validate:"min=0,max=150"`
    Email    string `validate:"omitempty,email"`
    Status   string `validate:"required,oneof=active inactive pending"`
}

func TestValidator(t *testing.T) {
    validator := Validator()
    assert.NotNil(t, validator)
    
    // Test that we get the same instance (singleton)
    validator2 := Validator()
    assert.Equal(t, validator, validator2)
}

func TestStruct_ValidData(t *testing.T) {
    validData := TestStruct{
        ID:     "550e8400-e29b-41d4-a716-446655440000",
        Name:   "Test Name",
        Age:    25,
        Email:  "test@example.com",
        Status: "active",
    }

    err := Struct(validData)
    assert.NoError(t, err)
}

func TestStruct_InvalidUUID(t *testing.T) {
    invalidData := TestStruct{
        ID:     "invalid-uuid",
        Name:   "Test Name",
        Age:    25,
        Status: "active",
    }

    err := Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "uuid4")
}

func TestStruct_RequiredField(t *testing.T) {
    invalidData := TestStruct{
        ID:     "550e8400-e29b-41d4-a716-446655440000",
        Name:   "", // Required field is empty
        Age:    25,
        Status: "active",
    }

    err := Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "required")
}

func TestStruct_InvalidOneof(t *testing.T) {
    invalidData := TestStruct{
        ID:     "550e8400-e29b-41d4-a716-446655440000",
        Name:   "Test Name",
        Age:    25,
        Status: "invalid-status", // Not in oneof list
    }

    err := Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "oneof")
}

func TestStruct_InvalidEmail(t *testing.T) {
    invalidData := TestStruct{
        ID:     "550e8400-e29b-41d4-a716-446655440000",
        Name:   "Test Name",
        Age:    25,
        Email:  "invalid-email", // Invalid email format
        Status: "active",
    }

    err := Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "email")
}

func TestStruct_MinMaxValidation(t *testing.T) {
    // Test min validation
    invalidData := TestStruct{
        ID:     "550e8400-e29b-41d4-a716-446655440000",
        Name:   "Test Name",
        Age:    -1, // Below minimum
        Status: "active",
    }

    err := Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "min")

    // Test max validation
    invalidData.Age = 200 // Above maximum
    err = Struct(invalidData)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "max")
}