import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import React, { useEffect, useRef, useState } from 'react';

interface NewFileDialogProps {
  isOpen: boolean;
  isFolder: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const NewFileDialog: React.FC<NewFileDialogProps> = ({
  isOpen,
  isFolder,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Reset the input and focus it when dialog opens
      setName('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {isFolder ? 'Folder' : 'File'}</DialogTitle>
          <DialogDescription>
            Enter a name for your new {isFolder ? 'folder' : 'file'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {isFolder ? 'Folder Name' : 'File Name'}
            </Label>
            <Input
              id="name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isFolder ? 'my-folder' : 'my-file.txt'}
            />
            {!isFolder && !name.includes('.') && (
              <p className="text-xs text-muted-foreground">
                Tip: Include a file extension (e.g., .txt, .js, .st)
              </p>
            )}
          </div>

          <DialogFooter className="flex justify-end gap-2 pt-2">
            <DialogPrimitive.Close asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewFileDialog;
