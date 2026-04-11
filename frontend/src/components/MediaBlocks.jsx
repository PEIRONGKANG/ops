import { useRef, useState } from "react";

const IMAGE_PLACEHOLDER = "__OPS_IMAGE_PENDING__";

export function ImagePreviewGrid({ images }) {
  const sourceList = Array.isArray(images) ? images : [];
  const pendingCount = sourceList.filter((src) => src === IMAGE_PLACEHOLDER).length;
  const visibleImages = sourceList.filter((src) => src && src !== IMAGE_PLACEHOLDER);

  if (!visibleImages.length && !pendingCount) {
    return <p className="media-empty">暂无图片</p>;
  }

  return (
    <>
      {pendingCount ? (
        <p className="media-empty media-loading-tip">
          图片加载中：{pendingCount} 张
        </p>
      ) : null}
      <div className="media-preview-grid">
        {visibleImages.map((src, index) => (
          <img
            key={`${src.slice(0, 24)}-${index}`}
            src={src}
            alt="上传预览"
            className="media-preview-item"
          />
        ))}
      </div>
    </>
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
