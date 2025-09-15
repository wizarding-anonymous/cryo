package s3

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// Options holds configuration for the S3 client.
type Options struct {
	Endpoint        string
	Region          string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
}

// Client is a wrapper around the AWS S3 client.
type Client struct {
	presignClient *s3.PresignClient
	bucket        string
}

// Interface describes the methods implemented by the S3 client.
type Interface interface {
	GetPresignedURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error)
}

// NewClient creates a new S3 client.
func NewClient(ctx context.Context, opts Options) (Interface, error) {
	resolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if opts.Endpoint != "" {
			return aws.Endpoint{
				URL:           opts.Endpoint,
				SigningRegion: opts.Region,
			}, nil
		}
		// returning aws.Endpoint{}, nil will allow the default resolver to be used
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	creds := credentials.NewStaticCredentialsProvider(opts.AccessKeyID, opts.SecretAccessKey, "")

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithEndpointResolverWithOptions(resolver),
		config.WithCredentialsProvider(creds),
		config.WithRegion(opts.Region),
	)
	if err != nil {
		return nil, err
	}

	s3Client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = true // Necessary for MinIO and other S3-compatibles
	})

	return &Client{
		presignClient: s3.NewPresignClient(s3Client),
		bucket:        opts.Bucket,
	}, nil
}

// GetPresignedURL generates a presigned URL for an S3 object.
func (c *Client) GetPresignedURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error) {
	req, err := c.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(c.bucket),
		Key:    aws.String(objectKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = lifetime
	})
	if err != nil {
		return "", err
	}
	return req.URL, nil
}
