/**
 * Utility functions for loading IEC-61131 files from the project
 */

export interface IECFile {
  fileName: string;
  content: string;
}

/**
 * Fetches all .st files from the Logic directory
 */
export async function fetchLogicFiles(): Promise<IECFile[]> {
  try {
    // First, we need to get a list of all .st files in the Logic directory
    const response = await fetch('/api/files?path=Logic&extension=.st');

    if (!response.ok) {
      throw new Error(`Failed to fetch file list: ${response.statusText}`);
    }

    const fileList = (await response.json()) as string[];

    // Then fetch the content of each file
    const files = await Promise.all(
      fileList.map(async (fileName) => {
        try {
          const fileResponse = await fetch(`/Logic/${fileName}`);

          if (!fileResponse.ok) {
            console.error(
              `Failed to fetch file ${fileName}: ${fileResponse.statusText}`
            );
            return {
              fileName,
              content: `// Error loading file: ${fileResponse.statusText}`,
            };
          }

          const content = await fileResponse.text();
          return { fileName, content };
        } catch (err) {
          console.error(`Error loading file ${fileName}:`, err);
          return {
            fileName,
            content: `// Error loading file: ${
              err instanceof Error ? err.message : String(err)
            }`,
          };
        }
      })
    );

    return files;
  } catch (error) {
    console.error('Error fetching Logic files:', error);
    throw error;
  }
}

/**
 * Fallback function to fetch a sample file if the API fails
 */
export function getSampleFile(): IECFile {
  // Provide a simple sample IEC 61131-3 file for testing
  return {
    fileName: 'sample.st',
    content: `
PROGRAM sample
  VAR
    counter : INT := 0;
    running : BOOL := TRUE;
  END_VAR

  IF running THEN
    counter := counter + 1;

    IF counter > 100 THEN
      running := FALSE;
    END_IF;
  END_IF;
END_PROGRAM
`,
  };
}

/**
 * Searches for files in the Logic directory and its subdirectories
 */
export async function findAllSTFilesInLogic(): Promise<IECFile[]> {
  try {
    // Attempt to get files from the API first
    const files = await fetchLogicFiles();

    if (files.length > 0) {
      return files;
    }

    // If no files found or API fails, offer a sample file instead
    console.log('No ST files found in Logic directory, using sample file');
    return [getSampleFile()];
  } catch (error) {
    console.error('Error finding ST files:', error);

    // Fallback to sample file
    return [getSampleFile()];
  }
}
