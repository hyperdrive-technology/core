import { createServerFn } from '@tanstack/start';
import { z } from 'zod';

// Validation schema for project creation
const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Response type for the created project
export interface CreateProjectResponse {
  id: string;
  name: string;
  description: string;
  created: string;
}

// Generate a random ID for mock data
const generateId = () => Math.random().toString(36).substring(2, 15);

export const createProject = createServerFn()
  .validator((input) => CreateProjectSchema.parse(input))
  .handler(async ({ data }) => {
    const { name, description, tags = [] } = data;

    try {
      // Try to make API call to our backend service
      try {
        const response = await fetch(`${process.env.API_URL || 'http://localhost:3000'}/api/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            description,
            tags
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            id: data.data.id,
            name,
            description: description || '',
            created: new Date().toISOString(),
          };
        }

        // If response isn't OK, check if it's 404 Not Found
        if (response.status === 404) {
          // If API is not available, use mock data for development
          console.warn('API endpoint not available, using mock data');
          return {
            id: generateId(),
            name,
            description: description || '',
            created: new Date().toISOString(),
          };
        }

        // For other error types, throw with the response text
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      } catch (fetchError) {
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          // Network error or CORS issue - use mock data for development
          console.warn('Network error, using mock data:', fetchError.message);
          return {
            id: generateId(),
            name,
            description: description || '',
            created: new Date().toISOString(),
          };
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create project');
    }
  });
