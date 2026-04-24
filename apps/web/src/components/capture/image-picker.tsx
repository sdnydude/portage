"use client";

import { useRef, useCallback } from "react";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic,image/heif";

interface ImagePickerProps {
  onSelect: (files: File[]) => void;
  multiple?: boolean;
  children: React.ReactNode;
}

export function ImagePicker({ onSelect, multiple = false, children }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        onSelect(files);
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onSelect],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple={multiple}
        capture={undefined}
        onChange={handleChange}
        className="hidden"
      />
      <div onClick={handleClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleClick()}>
        {children}
      </div>
    </>
  );
}
