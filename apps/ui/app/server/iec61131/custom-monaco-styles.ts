/**
 * Apply custom CSS styles to ensure VAR and END_VAR are properly highlighted
 */
export function applyCustomMonacoStyles(): void {
  // Create a style element
  const styleElement = document.createElement('style');

  // Add the CSS rules
  styleElement.textContent = `
    /* Custom styles for IEC 61131 syntax highlighting */
    .mtk1.keyword,
    .mtk1.VAR,
    .mtk1.END_VAR {
      color: #0000FF !important;
      font-weight: bold !important;
    }

    /* Make sure that specific tokens like VAR and END_VAR are properly highlighted */
    .monaco-editor .token.keyword-VAR,
    .monaco-editor .token.keyword-END_VAR {
      color: #0000FF !important;
      font-weight: bold !important;
    }

    /* Ensure that section keywords are properly highlighted */
    .mtk1.section.keyword {
      color: #800080 !important;
      font-weight: bold !important;
    }
  `;

  // Append the style element to the document head
  document.head.appendChild(styleElement);

  console.log('Applied custom Monaco styles for VAR/END_VAR highlighting');
}
