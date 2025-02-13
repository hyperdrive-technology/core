import { defineDocumentTree } from '@fumadocs/core';
import { createMDXSource } from '@fumadocs/mdx';

export const { tree, source } = defineDocumentTree({
  baseUrl: '/docs',
  rootDir: './content',
  source: createMDXSource('./content'),
});
