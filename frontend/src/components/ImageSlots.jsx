import React, { useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { fileToResizedDataUrl } from '../imageUtils.js';

export default function ImageSlots({ images, onChange, max = 3 }) {
  const inputRef = useRef(null);
  const slots = [...images, ...Array(max - images.length).fill(null)];

  const addImage = async (file) => {
    if (!file) return;
    const dataUrl = await fileToResizedDataUrl(file);
    onChange([...images, dataUrl].slice(0, max));
  };

  const removeImage = (idx) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <span className="text-[11px] text-muted">Photos ({images.length}/{max})</span>
      <div className="grid grid-cols-3 gap-2 mt-1">
        {slots.map((img, idx) =>
          img ? (
            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 bg-ink/60 text-white rounded-full p-0.5"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              key={idx}
              type="button"
              disabled={images.length >= max}
              onClick={() => inputRef.current?.click()}
              className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center text-muted disabled:opacity-40"
            >
              <Camera size={18} />
            </button>
          )
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}
