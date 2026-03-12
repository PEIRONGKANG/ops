import { useRef, useState } from "react";

export function ImagePreviewGrid({ images }) {
  if (!images?.length) {
    return <p className="text-sm text-stone-500">暂无图片</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {images.map((src, index) => (
        <img
          key={`${src.slice(0, 24)}-${index}`}
          src={src}
          alt="上传预览"
          className="h-32 w-full rounded-[20px] border border-[var(--line)] bg-[var(--surface-muted)] object-cover shadow-[0_14px_28px_rgba(19,33,24,0.06)]"
        />
      ))}
    </div>
  );
}

export function FilePickerButton({
  buttonText = "添加图片",
  disabled = false,
  accept = "image/*",
  multiple = true,
  onSelect,
}) {
  const inputRef = useRef(null);
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (disabled || pending) return;
    inputRef.current?.click();
  };

  const handleChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !onSelect) return;
    setPending(true);
    try {
      await onSelect(files);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled || pending}
        onChange={handleChange}
      />
      <button className="btn-secondary" type="button" onClick={handleClick} disabled={disabled || pending}>
        {pending ? "上传中..." : buttonText}
      </button>
    </>
  );
}
