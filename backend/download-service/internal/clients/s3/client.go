package s3

import (
    "context"
    "errors"
    "fmt"
    "sync"
    "time"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/credentials"
    awss3 "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// Options holds configuration for the S3 client.
type Options struct {
    Endpoint        string
    Region          string
    AccessKeyID     string
    SecretAccessKey string
    Bucket          string
}

// ObjectInfo represents basic metadata about the object stored in S3 compatible storage.
type ObjectInfo struct {
    Key          string
    Size         int64
    LastModified time.Time
}

// ErrNotFound is returned when the object or prefix does not exist.
var ErrNotFound = errors.New("s3 object not found")

// Client is a wrapper around the AWS S3 client.
type Client struct {
    presignClient *awss3.PresignClient
    s3Client      *awss3.Client
    bucket        string
}

// Interface describes the methods implemented by the S3 client.
type Interface interface {
    GetPresignedURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error)
    StatObject(ctx context.Context, objectKey string) (ObjectInfo, error)
    CleanupPrefix(ctx context.Context, prefix string) error
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

    s3Client := awss3.NewFromConfig(cfg, func(o *awss3.Options) {
        o.UsePathStyle = true // Necessary for MinIO and other S3-compatibles
    })

    return &Client{
        presignClient: awss3.NewPresignClient(s3Client),
        s3Client:      s3Client,
        bucket:        opts.Bucket,
    }, nil
}

// GetPresignedURL generates a presigned URL for an S3 object.
func (c *Client) GetPresignedURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error) {
    req, err := c.presignClient.PresignGetObject(ctx, &awss3.GetObjectInput{
        Bucket: aws.String(c.bucket),
        Key:    aws.String(objectKey),
    }, func(opts *awss3.PresignOptions) {
        opts.Expires = lifetime
    })
    if err != nil {
        return "", err
    }
    return req.URL, nil
}

// StatObject requests metadata for the object and returns its size and last modified timestamp.
func (c *Client) StatObject(ctx context.Context, objectKey string) (ObjectInfo, error) {
    out, err := c.s3Client.HeadObject(ctx, &awss3.HeadObjectInput{
        Bucket: aws.String(c.bucket),
        Key:    aws.String(objectKey),
    })
    if err != nil {
        var nfe *types.NotFound
        if errors.As(err, &nfe) {
            return ObjectInfo{}, ErrNotFound
        }
        return ObjectInfo{}, err
    }
    info := ObjectInfo{Key: objectKey, Size: aws.ToInt64(out.ContentLength)}
    if out.LastModified != nil {
        info.LastModified = *out.LastModified
    }
    return info, nil
}

// CleanupPrefix removes any temporary objects with the provided prefix.
func (c *Client) CleanupPrefix(ctx context.Context, prefix string) error {
    const pageSize = int32(1000)
    pager := awss3.NewListObjectsV2Paginator(c.s3Client, &awss3.ListObjectsV2Input{
        Bucket: aws.String(c.bucket),
        Prefix: aws.String(prefix),
        MaxKeys: aws.Int32(pageSize),
    })

    var toDelete []types.ObjectIdentifier
    for pager.HasMorePages() {
        page, err := pager.NextPage(ctx)
        if err != nil {
            return err
        }
        for _, obj := range page.Contents {
            if obj.Key != nil {
                toDelete = append(toDelete, types.ObjectIdentifier{Key: obj.Key})
            }
        }
    }
    if len(toDelete) == 0 {
        return nil
    }

    batches := chunkObjects(toDelete, 1000)
    for _, batch := range batches {
        _, err := c.s3Client.DeleteObjects(ctx, &awss3.DeleteObjectsInput{
            Bucket: aws.String(c.bucket),
            Delete: &types.Delete{Objects: batch, Quiet: aws.Bool(true)},
        })
        if err != nil {
            return err
        }
    }
    return nil
}

func chunkObjects(objects []types.ObjectIdentifier, size int) [][]types.ObjectIdentifier {
    if size <= 0 {
        return [][]types.ObjectIdentifier{objects}
    }
    var chunks [][]types.ObjectIdentifier
    for start := 0; start < len(objects); start += size {
        end := start + size
        if end > len(objects) {
            end = len(objects)
        }
        chunk := make([]types.ObjectIdentifier, end-start)
        copy(chunk, objects[start:end])
        chunks = append(chunks, chunk)
    }
    return chunks
}

// NewMockClient returns in-memory implementation for local development and tests.
func NewMockClient() *MockClient {
    return &MockClient{
        objects: make(map[string]mockObject),
        bucket:  "mock",
    }
}

type mockObject struct {
    size         int64
    lastModified time.Time
    content      []byte
}

type MockClient struct {
    mu      sync.RWMutex
    objects map[string]mockObject
    bucket  string
}

func (m *MockClient) GetPresignedURL(ctx context.Context, objectKey string, lifetime time.Duration) (string, error) {
    // For mock we just return a deterministic fake URL.
    return fmt.Sprintf("mock://%s/%s?expires_in=%d", m.bucket, objectKey, int(lifetime.Seconds())), nil
}

func (m *MockClient) StatObject(ctx context.Context, objectKey string) (ObjectInfo, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    obj, ok := m.objects[objectKey]
    if !ok {
        return ObjectInfo{}, ErrNotFound
    }
    return ObjectInfo{Key: objectKey, Size: obj.size, LastModified: obj.lastModified}, nil
}

func (m *MockClient) CleanupPrefix(ctx context.Context, prefix string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    removed := false
    for key := range m.objects {
        if len(prefix) == 0 || (len(key) >= len(prefix) && key[:len(prefix)] == prefix) {
            delete(m.objects, key)
            removed = true
        }
    }
    if !removed {
        return ErrNotFound
    }
    return nil
}

// PutObject allows tests to add data into the mock storage.
func (m *MockClient) PutObject(key string, size int64, content []byte) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.objects[key] = mockObject{size: size, lastModified: time.Now(), content: content}
}

