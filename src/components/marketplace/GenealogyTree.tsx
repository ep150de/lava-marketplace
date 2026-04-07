"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getInscriptionPreviewUrl, type InscriptionSummary, type InscriptionGenealogy } from "@/lib/ordinals/inscription";
import { fetchInscriptionChildrenPage } from "@/lib/ordinals/inscription";
import { truncateInscriptionId } from "@/utils/format";
import { Loader } from "@/components/crt";

interface GenealogyTreeProps {
  inscriptionId: string;
  initialGenealogy?: InscriptionGenealogy | null;
}

interface ChildTreeState {
  children: InscriptionSummary[];
  hasMore: boolean;
  page: number;
  expanded: boolean;
  loading: boolean;
  loadMore: () => void;
  remaining: number;
}

const PAGE_SIZE = 16;

export function GenealogyTree({ inscriptionId, initialGenealogy }: GenealogyTreeProps) {
  const router = useRouter();
  const [genealogy, setGenealogy] = useState<InscriptionGenealogy | null>(
    initialGenealogy ?? null
  );
  const loading = !genealogy;
  const [parentsExpanded, setParentsExpanded] = useState(true);
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const [parentPage, setParentPage] = useState(0);
  const [childPage, setChildPage] = useState(0);
  const [childTrees, setChildTrees] = useState<
    Record<string, ChildTreeState>
  >({});

  const loadChildTree = useCallback(
    async (childId: string) => {
      if (childTrees[childId]) return;

      let localPage = 0;

      const loadMore = async () => {
        setChildTrees((prev) => {
          const current = prev[childId];
          if (!current) return prev;
          return {
            ...prev,
            [childId]: { ...current, loading: true },
          };
        });

        const nextPage = localPage + 1;
        const result = await fetchInscriptionChildrenPage(childId, nextPage);
        const newSummaries = await buildSummariesFromIds(result.ids);

        setChildTrees((prev) => {
          const current = prev[childId];
          if (!current) return prev;
          return {
            ...prev,
            [childId]: {
              ...current,
              children: [...current.children, ...newSummaries],
              hasMore: result.more,
              page: nextPage,
              loading: false,
              remaining: result.more ? (prev[childId]?.remaining ?? 0) + result.ids.length : 0,
            },
          };
        });
        localPage = nextPage;
      };

      const result = await fetchInscriptionChildrenPage(childId, 0);
      const summaries = await buildSummariesFromIds(result.ids);

      setChildTrees((prev) => ({
        ...prev,
        [childId]: {
          children: summaries,
          hasMore: result.more,
          page: 0,
          expanded: true,
          loading: false,
          remaining: result.ids.length,
          loadMore,
        },
      }));
    },
    [childTrees]
  );

  const toggleChildTree = useCallback(
    (childId: string) => {
      const existing = childTrees[childId];
      if (!existing) {
        loadChildTree(childId);
      } else {
        setChildTrees((prev) => ({
          ...prev,
          [childId]: { ...existing, expanded: !existing.expanded },
        }));
      }
    },
    [childTrees, loadChildTree]
  );

  const loadMoreParents = useCallback(async () => {
    if (!genealogy || !genealogy.hasMoreParents) return;
    const nextPage = parentPage + 1;
    const result = await fetchInscriptionChildrenPage(inscriptionId, nextPage);
    const newSummaries = await buildSummariesFromIds(result.ids);
    setGenealogy((prev) =>
      prev
        ? {
            ...prev,
            parents: [...prev.parents, ...newSummaries],
            hasMoreParents: result.more,
          }
        : prev
    );
    setParentPage(nextPage);
  }, [genealogy, parentPage, inscriptionId]);

  const loadMoreChildren = useCallback(async () => {
    if (!genealogy || !genealogy.hasMoreChildren) return;
    const nextPage = childPage + 1;
    const result = await fetchInscriptionChildrenPage(inscriptionId, nextPage);
    const newSummaries = await buildSummariesFromIds(result.ids);
    setGenealogy((prev) =>
      prev
        ? {
            ...prev,
            children: [...prev.children, ...newSummaries],
            hasMoreChildren: result.more,
          }
        : prev
    );
    setChildPage(nextPage);
  }, [genealogy, childPage, inscriptionId]);

  if (loading) {
    return (
      <div className="genealogy-section">
        <div className="genealogy-header">GENEALOGY</div>
        <div className="py-4 flex justify-center">
          <Loader text="LOADING GENEALOGY" variant="cursor" />
        </div>
      </div>
    );
  }

  if (!genealogy) {
    return (
      <div className="genealogy-section">
        <div className="genealogy-header">── GENEALOGY ────────────────────────────────────</div>
        <div className="text-crt-dim text-xs font-mono p-4">
          NO GENEALOGY DATA AVAILABLE
        </div>
      </div>
    );
  }

  const visibleParents = genealogy.parents.slice(0, PAGE_SIZE);
  const visibleChildren = genealogy.children.slice(0, PAGE_SIZE);
  const parentCount = genealogy.parents.length;
  const childCount = genealogy.children.length;

  return (
    <div className="genealogy-section">
      <div className="genealogy-header">── GENEALOGY ────────────────────────────────────</div>

      {/* Parents */}
      <div className="genealogy-subsection">
        <button
          onClick={() => setParentsExpanded(!parentsExpanded)}
          className="genealogy-section-title text-crt-dim hover:text-crt w-full text-left"
        >
          PARENTS ({parentCount}) {parentsExpanded ? "[−]" : "[+]"}
        </button>
        {parentsExpanded && (
          <div className="genealogy-grid">
            {visibleParents.map((p) => (
              <div key={p.id} className="genealogy-grid-item">
                <div className="genealogy-preview">
                  <iframe
                    src={getInscriptionPreviewUrl(p.id)}
                    title={`Inscription ${p.id}`}
                    sandbox="allow-scripts allow-same-origin"
                    loading="lazy"
                    className="w-full h-full"
                  />
                </div>
                <div className="genealogy-info">
                  <button
                    onClick={() => router.push(`/item/${p.id}`)}
                    className="text-crt-bright hover:text-crt text-xs font-mono cursor-pointer"
                  >
                    #{p.number > 0 ? p.number.toLocaleString() : "???"}
                  </button>
                  <div className="text-crt-dim text-[10px] font-mono">
                    {truncateInscriptionId(p.id, 8)}
                  </div>
                  {p.contentType && (
                    <div className="text-crt-dim text-[10px] font-mono truncate">
                      {p.contentType}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {genealogy.hasMoreParents && parentCount > PAGE_SIZE && (
              <div className="genealogy-load-more-row">
                <button
                  onClick={loadMoreParents}
                  className="genealogy-load-more text-crt-dim hover:text-crt text-xs font-mono"
                >
                  LOAD MORE PARENTS ({parentCount} TOTAL) →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      <div className="genealogy-subsection">
        <button
          onClick={() => setChildrenExpanded(!childrenExpanded)}
          className="genealogy-section-title text-crt-dim hover:text-crt w-full text-left"
        >
          CHILDREN ({childCount}) {childrenExpanded ? "[−]" : "[+]"}
        </button>
        {childrenExpanded && (
          <div className="genealogy-grid">
            {visibleChildren.map((c) => {
              const childTree = childTrees[c.id];
              return (
                <div key={c.id} className="genealogy-grid-item">
                  <div className="genealogy-preview">
                    <iframe
                      src={getInscriptionPreviewUrl(c.id)}
                      title={`Inscription ${c.id}`}
                      sandbox="allow-scripts allow-same-origin"
                      loading="lazy"
                      className="w-full h-full"
                    />
                  </div>
                  <div className="genealogy-info">
                    <button
                      onClick={() => router.push(`/item/${c.id}`)}
                      className="text-crt-bright hover:text-crt text-xs font-mono cursor-pointer"
                    >
                      #{c.number > 0 ? c.number.toLocaleString() : "???"}
                    </button>
                    <div className="text-crt-dim text-[10px] font-mono">
                      {truncateInscriptionId(c.id, 8)}
                    </div>
                    {c.contentType && (
                      <div className="text-crt-dim text-[10px] font-mono truncate">
                        {c.contentType}
                      </div>
                    )}
                    <button
                      onClick={() => toggleChildTree(c.id)}
                      className="genealogy-expand-btn text-crt-dim hover:text-crt text-[10px] font-mono mt-1"
                    >
                      {childTree?.expanded ? "[−HIDE]" : "[→SHOW CHILDREN]"}
                    </button>
                  </div>
                  {childTree?.expanded && (
                    <div className="genealogy-nested">
                      {childTree.loading ? (
            <Loader text="LOADING" variant="cursor" />
                      ) : (
                        <>
                          {childTree.children.map((gc) => (
                            <div key={gc.id} className="genealogy-row genealogy-row--nested">
                              <div className="genealogy-preview">
                                <iframe
                                  src={getInscriptionPreviewUrl(gc.id)}
                                  title={`Inscription ${gc.id}`}
                                  sandbox="allow-scripts allow-same-origin"
                                  loading="lazy"
                                  className="w-full h-full"
                                />
                              </div>
                              <div className="genealogy-info">
                                <button
                                  onClick={() => router.push(`/item/${gc.id}`)}
                                  className="text-crt hover:text-crt-bright text-xs font-mono cursor-pointer"
                                >
                                  #{gc.number > 0 ? gc.number.toLocaleString() : "???"}
                                </button>
                                <div className="text-crt-dim text-[10px] font-mono">
                                  {truncateInscriptionId(gc.id, 8)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {childTree.hasMore && (
                            <button
                              onClick={childTree.loadMore}
                              className="genealogy-load-more text-crt-dim hover:text-crt text-xs font-mono"
                            >
                              [+{childTree.remaining}+ MORE]
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {genealogy.hasMoreChildren && childCount > PAGE_SIZE && (
              <div className="genealogy-load-more-row">
                <button
                  onClick={loadMoreChildren}
                  className="genealogy-load-more text-crt-dim hover:text-crt text-xs font-mono"
                >
                  LOAD MORE CHILDREN ({childCount} TOTAL) →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

async function buildSummariesFromIds(ids: string[]): Promise<InscriptionSummary[]> {
  if (ids.length === 0) return [];
  const { fetchInscriptionInfo } = await import("@/lib/ordinals/inscription");
  const batchSize = 20;
  const summaries: InscriptionSummary[] = [];

  for (let i = 0; i < Math.min(ids.length, 100); i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const infos = await Promise.all(batch.map((id) => fetchInscriptionInfo(id)));

    for (const info of infos) {
      if (info) {
        summaries.push({
          id: info.id,
          number: info.number,
          output: info.output,
          timestamp: info.timestamp,
          contentType: info.content_type,
        });
      }
    }
  }

  return summaries;
}
