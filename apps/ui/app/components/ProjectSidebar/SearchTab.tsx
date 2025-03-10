import { Search } from 'lucide-react';
import { useState } from 'react';
import { FileNode } from '../types';

export interface SearchTabProps {
  files: FileNode[];
  onSelectFile: (node: FileNode) => void;
}

export default function SearchTab({ files, onSelectFile }: SearchTabProps) {
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<
    {
      node: FileNode;
      line: number;
      content: string;
      matches: { index: number; length: number }[];
    }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);

  // Function to handle search
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results: typeof searchResults = [];

    // Helper function to search recursively through files
    const searchInNode = (node: FileNode) => {
      if (!node.isFolder && node.content) {
        const lines = node.content.split('\n');

        lines.forEach((line, lineIndex) => {
          const regex = new RegExp(searchTerm, 'gi');
          let match;
          const matches: { index: number; length: number }[] = [];

          while ((match = regex.exec(line)) !== null) {
            matches.push({ index: match.index, length: match[0].length });
          }

          if (matches.length > 0) {
            results.push({
              node,
              line: lineIndex + 1,
              content: line,
              matches,
            });
          }
        });
      }

      if (node.isFolder && node.children) {
        node.children.forEach(searchInNode);
      }
    };

    // Search through all files
    files.forEach(searchInNode);

    setSearchResults(results);
    setIsSearching(false);
  };

  return (
    <>
      <div className="p-2 font-semibold flex justify-between items-center border-b dark:border-gray-700">
        <span>Search</span>
      </div>
      <div className="p-4 flex flex-col">
        <div className="flex border rounded-md overflow-hidden mb-4">
          <input
            type="text"
            placeholder="Search in files..."
            className="flex-1 p-2 focus:outline-none dark:bg-gray-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
          />
          <button
            className="px-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={handleSearch}
            disabled={isSearching}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {isSearching ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Searching...
          </div>
        ) : searchResults.length > 0 ? (
          <div className="overflow-auto">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => onSelectFile(result.node)}
              >
                <div className="font-medium">{result.node.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Line {result.line}
                </div>
                <div className="mt-1 text-sm font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded overflow-x-auto whitespace-pre">
                  {result.content}
                </div>
              </div>
            ))}
          </div>
        ) : searchTerm ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No results found for "{searchTerm}".
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Enter a search term to find in your project files.
          </div>
        )}
      </div>
    </>
  );
}
