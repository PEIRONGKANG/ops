import { useState } from "react";

import { filesToDataUrls } from "../lib/core";

const DEFAULT_RESOURCE_FORM = {
  title: "",
  category: "制度文件",
  description: "",
  fileName: "",
  fileData: "",
  externalUrl: "",
};

function trimText(value) {
  return String(value || "").trim();
}

export function ResourcesTab({ resources, editable, onCreateResource, onDeleteResource }) {
  const [resourceForm, setResourceForm] = useState(DEFAULT_RESOURCE_FORM);

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const [fileData] = await filesToDataUrls(files.slice(0, 1));
    setResourceForm((current) => ({
      ...current,
      fileName: files[0].name,
      fileData: fileData || "",
    }));
    event.target.value = "";
  };

  const handleCreateResource = async () => {
    await onCreateResource({
      title: trimText(resourceForm.title),
      category: trimText(resourceForm.category),
      description: trimText(resourceForm.description),
      fileName: trimText(resourceForm.fileName),
      fileData: trimText(resourceForm.fileData),
      externalUrl: trimText(resourceForm.externalUrl),
    });
    setResourceForm(DEFAULT_RESOURCE_FORM);
  };

  return (
    <section className="space-y-6">
      {editable ? (
        <article className="soft-card">
          <p className="module-kicker">Resource Center</p>
          <h3 className="section-title mt-2">教学资源</h3>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <input
              className="field-input"
              value={resourceForm.title}
              onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="资源标题"
            />
            <select
              className="field-input"
              value={resourceForm.category}
              onChange={(event) => setResourceForm((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="制度文件">制度文件</option>
              <option value="课程模板">课程模板</option>
              <option value="示例作品">示例作品</option>
              <option value="参考资料">参考资料</option>
            </select>
            <input
              className="field-input"
              value={resourceForm.externalUrl}
              onChange={(event) => setResourceForm((current) => ({ ...current, externalUrl: event.target.value }))}
              placeholder="外部链接（可选）"
            />
            <label className="field-input flex cursor-pointer items-center justify-between gap-3">
              <span className="truncate text-[#685f58]">{resourceForm.fileName || "上传本地文件（可选）"}</span>
              <input className="hidden" type="file" onChange={handleFileChange} />
            </label>
          </div>
          <textarea
            className="field-input mt-3 min-h-[120px]"
            value={resourceForm.description}
            onChange={(event) => setResourceForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="资源说明"
          />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary" type="button" onClick={handleCreateResource}>
              新增资源
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => setResourceForm(DEFAULT_RESOURCE_FORM)}
            >
              清空表单
            </button>
          </div>
        </article>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {resources.map((resource) => (
          <article key={resource.id} className="soft-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="module-kicker">{resource.category}</p>
                <h3 className="section-title mt-2 !text-[1.6rem]">{resource.title}</h3>
              </div>
              {editable ? (
                <button
                  className="rounded-full border border-[#d8ccc0] px-3 py-1 text-sm text-[#685f58] transition hover:border-[#b8714f] hover:text-[#171311]"
                  type="button"
                  onClick={() => onDeleteResource(resource.id)}
                >
                  删除
                </button>
              ) : null}
            </div>

            {resource.description ? (
              <p className="status-line mt-4">{resource.description}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-3">
              {resource.externalUrl ? (
                <a
                  className="btn-secondary"
                  href={resource.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  打开链接
                </a>
              ) : null}
              {resource.fileData ? (
                <a
                  className="btn-secondary"
                  href={resource.fileData}
                  download={resource.fileName || `${resource.title}.bin`}
                >
                  下载附件
                </a>
              ) : null}
            </div>

            <p className="mt-4 text-sm text-[#685f58]">
              创建人：{resource.createdBy || "未记录"} {resource.fileName ? `· ${resource.fileName}` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
