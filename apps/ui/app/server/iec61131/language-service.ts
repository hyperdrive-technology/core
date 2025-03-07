import { setupLangiumMonaco } from './langium-monaco-setup';

/**
 * Language ID for IEC 61131-3 Structured Text
 */
export const IEC61131_LANGUAGE_ID = 'iec-61131';

/**
 * Register the IEC 61131-3 language with Monaco editor
 */
export function registerIEC61131Language(
  monaco: typeof import('monaco-editor'),
): void {
  try {
    // Set up the language and workers
    setupLangiumMonaco(monaco);
    console.log('IEC 61131-3 language registered with Monaco');
  } catch (error) {
    console.error('Failed to register IEC 61131-3 language:', error);
    throw error;
  }
}
