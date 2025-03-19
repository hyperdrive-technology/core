/**
 * Service for deploying compiled IEC-61131 code to the controller
 */

interface DeploymentResult {
  success: boolean;
  message: string;
  deployedFiles?: string[];
}

/**
 * Deploy compiled AST to the controller
 *
 * @param ast The abstract syntax tree generated during compilation
 * @returns A promise that resolves to a deployment result
 */
export async function deployToController(ast: any): Promise<DeploymentResult> {
  try {
    console.log('Deploying AST to controller:', ast);

    // Send the AST to the controller via API
    const response = await fetch('/api/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ast }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deployment failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      message: 'Deployment successful',
      deployedFiles: result.deployedFiles,
    };
  } catch (error) {
    console.error('Error deploying to controller:', error);

    return {
      success: false,
      message: `Deployment failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Check controller connectivity before deploying
 *
 * @returns A promise that resolves to a boolean indicating if the controller is online
 */
export async function isControllerOnline(): Promise<boolean> {
  try {
    const response = await fetch('/api/controller/status', {
      method: 'GET',
      cache: 'no-cache',
    });

    return response.ok;
  } catch (error) {
    console.error('Error checking controller status:', error);
    return false;
  }
}
