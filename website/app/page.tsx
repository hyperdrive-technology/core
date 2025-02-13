import { MDXContent } from '@fumadocs/mdx';
import { getPage } from '@fumadocs/mdx/source';
import { source } from './source';

export default async function Page() {
  const page = await getPage({
    source,
    path: '/',
  });

  if (!page) {
    return <div>Page not found</div>;
  }

  return <MDXContent source={page} />;
}
