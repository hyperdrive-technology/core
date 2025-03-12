package storage

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// ProjectMetadata contains information about a project
type ProjectMetadata struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	Created        time.Time `json:"created"`
	Modified       time.Time `json:"modified"`
	Owner          string    `json:"owner"`
	CurrentVersion string    `json:"currentVersion"`
	Tags           []string  `json:"tags"`
}

// ProjectConfig contains the configuration for a project
type ProjectConfig struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	MainProgram string `json:"mainProgram"`
	Runtime     struct {
		ScanTime int `json:"scanTime"`
	} `json:"runtime"`
	Tasks []struct {
		Name     string `json:"name"`
		Priority int    `json:"priority"`
		Interval string `json:"interval"`
		Program  string `json:"program"`
	} `json:"tasks"`
	Configuration struct {
		Name      string     `json:"name"`
		Resources []Resource `json:"resources"`
	} `json:"configuration"`
}

// StorageManager handles project storage operations
type StorageManager struct {
	client     *minio.Client
	bucketName string
	tempDir    string
}

// NewStorageManager creates a new storage manager
func NewStorageManager(endpoint, accessKey, secretKey, bucketName string) (*StorageManager, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: false, // Set to true for HTTPS
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	// Create bucket if it doesn't exist
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}

	if !exists {
		err = client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "hyperdrive-projects-")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}

	return &StorageManager{
		client:     client,
		bucketName: bucketName,
		tempDir:    tempDir,
	}, nil
}

// CreateProject creates a new project
func (sm *StorageManager) CreateProject(ctx context.Context, name, description, owner string, tags []string) (string, error) {
	// Generate unique project ID
	projectID := fmt.Sprintf("proj-%d", time.Now().UnixNano())

	// Create project metadata
	now := time.Now()
	version := fmt.Sprintf("%s-%s", now.Format("20060102"), projectID[5:13])

	metadata := ProjectMetadata{
		ID:             projectID,
		Name:           name,
		Description:    description,
		Created:        now,
		Modified:       now,
		Owner:          owner,
		CurrentVersion: version,
		Tags:           tags,
	}

	// Create project config
	config := ProjectConfig{
		Name:        name,
		Version:     version,
		MainProgram: "programs/main.st",
		Runtime: struct {
			ScanTime int `json:"scanTime"`
		}{
			ScanTime: 100,
		},
		Tasks: []struct {
			Name     string `json:"name"`
			Priority int    `json:"priority"`
			Interval string `json:"interval"`
			Program  string `json:"program"`
		}{
			{
				Name:     "MainTask",
				Priority: 1,
				Interval: "100ms",
				Program:  "Main",
			},
		},
	}

	// Create project structure in temp directory
	projectDir := filepath.Join(sm.tempDir, projectID)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create project directory: %w", err)
	}

	// Create folders
	folders := []string{
		"current/pou/programs",
		"current/pou/function_blocks",
		"current/pou/functions",
		"current/types",
		"current/variables",
		"current/config",
		"versions",
	}

	for _, folder := range folders {
		if err := os.MkdirAll(filepath.Join(projectDir, folder), 0755); err != nil {
			return "", fmt.Errorf("failed to create folder %s: %w", folder, err)
		}
	}

	// Create sample main program
	mainProgram := `PROGRAM Main
VAR
  counter : INT := 0;
END_VAR

counter := counter + 1;
IF counter > 100 THEN
  counter := 0;
END_IF;
END_PROGRAM`

	if err := os.WriteFile(filepath.Join(projectDir, "current/pou/programs/main.st"), []byte(mainProgram), 0644); err != nil {
		return "", fmt.Errorf("failed to write main program: %w", err)
	}

	// Write metadata and config
	metadataBytes, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal metadata: %w", err)
	}

	configBytes, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(filepath.Join(projectDir, "metadata.json"), metadataBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write metadata: %w", err)
	}

	if err := os.WriteFile(filepath.Join(projectDir, "current/project.json"), configBytes, 0644); err != nil {
		return "", fmt.Errorf("failed to write project config: %w", err)
	}

	// Create initial version archive
	versionPath := filepath.Join(projectDir, "versions", version+".zip")
	if err := sm.createZipArchive(filepath.Join(projectDir, "current"), versionPath); err != nil {
		return "", fmt.Errorf("failed to create version archive: %w", err)
	}

	// Upload to S3/Minio
	if err := sm.uploadProject(ctx, projectID, projectDir); err != nil {
		return "", fmt.Errorf("failed to upload project: %w", err)
	}

	return projectID, nil
}

// LoadProject loads a project from storage into memory
func (sm *StorageManager) LoadProject(ctx context.Context, projectID string) (string, error) {
	projectDir := filepath.Join(sm.tempDir, projectID)
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create project directory: %w", err)
	}

	// Download metadata
	metadataPath := filepath.Join(projectDir, "metadata.json")
	if err := sm.downloadFile(ctx, fmt.Sprintf("projects/%s/metadata.json", projectID), metadataPath); err != nil {
		return "", fmt.Errorf("failed to download metadata: %w", err)
	}

	// Parse metadata to get current version
	metadataBytes, err := os.ReadFile(metadataPath)
	if err != nil {
		return "", fmt.Errorf("failed to read metadata: %w", err)
	}

	var metadata ProjectMetadata
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
		return "", fmt.Errorf("failed to parse metadata: %w", err)
	}

	// Download current version files
	prefix := fmt.Sprintf("projects/%s/current/", projectID)
	if err := sm.downloadDirectory(ctx, prefix, filepath.Join(projectDir, "current")); err != nil {
		return "", fmt.Errorf("failed to download current version: %w", err)
	}

	return projectDir, nil
}

// SaveProject saves the current state of a project
func (sm *StorageManager) SaveProject(ctx context.Context, projectID, projectDir string) error {
	// Read metadata
	metadataPath := filepath.Join(projectDir, "metadata.json")
	metadataBytes, err := os.ReadFile(metadataPath)
	if err != nil {
		return fmt.Errorf("failed to read metadata: %w", err)
	}

	var metadata ProjectMetadata
	if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
		return fmt.Errorf("failed to parse metadata: %w", err)
	}

	// Create new version
	now := time.Now()
	version := fmt.Sprintf("%s-%s", now.Format("20060102"), projectID[5:13])
	metadata.CurrentVersion = version
	metadata.Modified = now

	// Update metadata file
	metadataBytes, err = json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	if err := os.WriteFile(metadataPath, metadataBytes, 0644); err != nil {
		return fmt.Errorf("failed to write metadata: %w", err)
	}

	// Update project config
	configPath := filepath.Join(projectDir, "current/project.json")
	configBytes, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read project config: %w", err)
	}

	var config ProjectConfig
	if err := json.Unmarshal(configBytes, &config); err != nil {
		return fmt.Errorf("failed to parse project config: %w", err)
	}

	config.Version = version

	configBytes, err = json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal project config: %w", err)
	}

	if err := os.WriteFile(configPath, configBytes, 0644); err != nil {
		return fmt.Errorf("failed to write project config: %w", err)
	}

	// Create version archive
	versionPath := filepath.Join(projectDir, "versions", version+".zip")
	if err := sm.createZipArchive(filepath.Join(projectDir, "current"), versionPath); err != nil {
		return fmt.Errorf("failed to create version archive: %w", err)
	}

	// Upload to S3/Minio
	if err := sm.uploadProject(ctx, projectID, projectDir); err != nil {
		return fmt.Errorf("failed to upload project: %w", err)
	}

	return nil
}

// Helper methods for file operations
func (sm *StorageManager) createZipArchive(sourceDir, destZip string) error {
	// Create the ZIP file
	if err := os.MkdirAll(filepath.Dir(destZip), 0755); err != nil {
		return err
	}

	zipFile, err := os.Create(destZip)
	if err != nil {
		return err
	}
	defer zipFile.Close()

	archive := zip.NewWriter(zipFile)
	defer archive.Close()

	// Walk through the source directory
	return filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories themselves (but we still want their contents)
		if info.IsDir() {
			return nil
		}

		// Create a relative path for the zip
		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}

		// Create a zip header
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = relPath
		header.Method = zip.Deflate

		// Add file to zip
		writer, err := archive.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})
}

func (sm *StorageManager) uploadProject(ctx context.Context, projectID, projectDir string) error {
	// Upload metadata
	metadataPath := filepath.Join(projectDir, "metadata.json")
	_, err := sm.client.FPutObject(ctx, sm.bucketName,
		fmt.Sprintf("projects/%s/metadata.json", projectID),
		metadataPath, minio.PutObjectOptions{})
	if err != nil {
		return err
	}

	// Upload current version files
	currentDir := filepath.Join(projectDir, "current")
	err = filepath.Walk(currentDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(currentDir, path)
		if err != nil {
			return err
		}

		objectName := fmt.Sprintf("projects/%s/current/%s", projectID, relPath)
		_, err = sm.client.FPutObject(ctx, sm.bucketName, objectName, path, minio.PutObjectOptions{})
		return err
	})
	if err != nil {
		return err
	}

	// Upload version archives
	versionsDir := filepath.Join(projectDir, "versions")
	files, err := os.ReadDir(versionsDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() || filepath.Ext(file.Name()) != ".zip" {
			continue
		}

		filePath := filepath.Join(versionsDir, file.Name())
		objectName := fmt.Sprintf("projects/%s/versions/%s", projectID, file.Name())
		_, err := sm.client.FPutObject(ctx, sm.bucketName, objectName, filePath, minio.PutObjectOptions{})
		if err != nil {
			return err
		}
	}

	return nil
}

func (sm *StorageManager) downloadFile(ctx context.Context, objectName, filePath string) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return err
	}

	return sm.client.FGetObject(ctx, sm.bucketName, objectName, filePath, minio.GetObjectOptions{})
}

func (sm *StorageManager) downloadDirectory(ctx context.Context, prefix, targetDir string) error {
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return err
	}

	objectCh := sm.client.ListObjects(ctx, sm.bucketName, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for object := range objectCh {
		if object.Err != nil {
			return object.Err
		}

		// Get the relative path from the prefix
		relPath, err := filepath.Rel(prefix, object.Key)
		if err != nil {
			return err
		}

		// Skip directories (S3 doesn't have directories, but objects might have "/" in their names)
		if relPath == "" || relPath[len(relPath)-1] == '/' {
			continue
		}

		targetPath := filepath.Join(targetDir, relPath)
		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return err
		}

		if err := sm.client.FGetObject(ctx, sm.bucketName, object.Key, targetPath, minio.GetObjectOptions{}); err != nil {
			return err
		}
	}

	return nil
}

// Close cleans up any temporary resources
func (sm *StorageManager) Close() error {
	return os.RemoveAll(sm.tempDir)
}

// CreateProgramTemplate creates a new program file
func (sm *StorageManager) CreateProgramTemplate(ctx context.Context, projectID, programName string) error {
	programContent := fmt.Sprintf(`PROGRAM %s
VAR
    // Internal variables
END_VAR

(* Program logic *)

END_PROGRAM`, programName)

	programPath := filepath.Join(sm.tempDir, projectID, "current/pou/programs", programName+".st")
	return os.WriteFile(programPath, []byte(programContent), 0644)
}

// CreateFunctionBlockTemplate creates a new function block file
func (sm *StorageManager) CreateFunctionBlockTemplate(ctx context.Context, projectID, fbName string) error {
	fbContent := fmt.Sprintf(`FUNCTION_BLOCK %s
VAR_INPUT
    // Input variables
END_VAR

VAR_OUTPUT
    // Output variables
END_VAR

VAR
    // Internal variables
END_VAR

(* Function block logic *)

END_FUNCTION_BLOCK`, fbName)

	fbPath := filepath.Join(sm.tempDir, projectID, "current/pou/function_blocks", fbName+".st")
	return os.WriteFile(fbPath, []byte(fbContent), 0644)
}

// UpdateProjectConfiguration updates the project configuration
func (sm *StorageManager) UpdateProjectConfiguration(ctx context.Context, projectID string,
	config ProjectConfig) error {

	projectDir := filepath.Join(sm.tempDir, projectID)
	configPath := filepath.Join(projectDir, "current/config", "configuration.json")

	configBytes, err := json.MarshalIndent(config.Configuration, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal configuration: %w", err)
	}

	if err := os.WriteFile(configPath, configBytes, 0644); err != nil {
		return fmt.Errorf("failed to write configuration: %w", err)
	}

	return nil
}

// ListProjects lists all projects in the storage
func (sm *StorageManager) ListProjects(ctx context.Context) ([]byte, error) {
	// List objects with prefix "projects/"
	objectCh := sm.client.ListObjects(ctx, sm.bucketName, minio.ListObjectsOptions{
		Prefix:    "projects/",
		Recursive: false,
	})

	var projects []ProjectMetadata

	// For each project folder, get metadata
	for object := range objectCh {
		if object.Err != nil {
			return nil, object.Err
		}

		// Extract project ID from path
		projectID := filepath.Base(object.Key)

		// Skip if not a directory
		if !strings.HasSuffix(object.Key, "/") {
			continue
		}

		// Download metadata
		metadataPath := filepath.Join(sm.tempDir, "tmp-metadata.json")
		err := sm.downloadFile(ctx, fmt.Sprintf("projects/%s/metadata.json", projectID), metadataPath)
		if err != nil {
			continue // Skip projects with missing metadata
		}

		// Read metadata
		metadataBytes, err := os.ReadFile(metadataPath)
		if err != nil {
			continue
		}

		var metadata ProjectMetadata
		if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
			continue
		}

		projects = append(projects, metadata)
	}

	// Marshal projects to JSON
	return json.Marshal(projects)
}
