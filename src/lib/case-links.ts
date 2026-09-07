export type ComplaintLinkRow = {
  id: string;
  complaint_id_a: string;
  complaint_id_b: string;
  matched_on: string;
  created_at: string;
};

export function buildLinkCountMap(links: ComplaintLinkRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.complaint_id_a, (counts.get(link.complaint_id_a) ?? 0) + 1);
    counts.set(link.complaint_id_b, (counts.get(link.complaint_id_b) ?? 0) + 1);
  }
  return counts;
}

export function otherComplaintId(link: ComplaintLinkRow, currentId: string): string {
  return link.complaint_id_a === currentId ? link.complaint_id_b : link.complaint_id_a;
}
