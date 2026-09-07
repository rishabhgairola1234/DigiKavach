// Evidence is uploaded to `${civilian_id}/${complaint_id}/${uuid}-${originalName}`
// (see the fileComplaint action) -- this recovers the original filename for display.
export function evidenceDisplayName(filePath: string): string {
  const fileName = filePath.split("/").pop() ?? filePath;
  return fileName.replace(/^[0-9a-f-]{36}-/, "");
}
